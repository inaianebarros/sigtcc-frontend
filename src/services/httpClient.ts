import {
  ApiError,
  INVALID_FORM_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  fieldErrorsFrom,
  messageForStatus,
  rateLimitMessage,
} from './apiError';
import type { FieldErrors } from './apiError';
import { tokenStore } from './tokenStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const REFRESH_PATH = '/auth/refresh';
const PATHS_WITHOUT_SESSION_RENEWAL = [
  '/auth/login',
  REFRESH_PATH,
  '/auth/logout',
];

export interface RequestOptions {
  renewSessionOn401?: boolean;
}

type SessionExpiredHandler = (message: string) => void;

let onSessionExpired: SessionExpiredHandler = () => {};
let refreshInFlight: Promise<RenewalOutcome> | null = null;

export function setSessionExpiredHandler(
  handler: SessionExpiredHandler,
): () => void {
  onSessionExpired = handler;
  return () => {
    onSessionExpired = () => {};
  };
}

type RenewalOutcome =
  | { renewed: true }
  | { renewed: false; rateLimited: false }
  | { renewed: false; rateLimited: true; retryAfterSeconds?: number };

/** Único ponto de renovação do token (ADR frontend 0001: cookie httpOnly de refresh). */
async function refreshAccessToken(): Promise<RenewalOutcome> {
  try {
    const response = await fetch(`${API_BASE_URL}${REFRESH_PATH}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (response.status === 429) {
      return {
        renewed: false,
        rateLimited: true,
        retryAfterSeconds: retryAfterSecondsOf(response),
      };
    }
    if (!response.ok) return { renewed: false, rateLimited: false };
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) return { renewed: false, rateLimited: false };
    tokenStore.set(body.access_token);
    return { renewed: true };
  } catch {
    return { renewed: false, rateLimited: false };
  }
}

function renewSession(): Promise<RenewalOutcome> {
  refreshInFlight ??= refreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function renewAccessToken(): Promise<boolean> {
  return (await renewSession()).renewed;
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, messageForStatus(0));
  }
}

/** O Retry-After vem em segundos ou como data HTTP (RFC 9110); devolve segundos, ou nada se inválido. */
function retryAfterSecondsOf(response: Response): number | undefined {
  const header = response.headers.get('Retry-After');
  if (header === null || header.trim() === '') return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds > 0 ? seconds : undefined;
  const untilDate = (Date.parse(header) - Date.now()) / 1000;
  return Number.isFinite(untilDate) && untilDate > 0
    ? Math.ceil(untilDate)
    : undefined;
}

async function parseError(response: Response): Promise<ApiError> {
  let detail: string | undefined;
  let fieldErrors: FieldErrors = {};
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') detail = body.detail;
    if (Array.isArray(body.detail)) fieldErrors = fieldErrorsFrom(body.detail);
  } catch {
    // corpo sem JSON: usa a mensagem padrão do status
  }
  const fallback =
    Object.keys(fieldErrors).length > 0
      ? INVALID_FORM_MESSAGE
      : messageForStatus(response.status);
  const retryAfterSeconds =
    response.status === 429 ? retryAfterSecondsOf(response) : undefined;
  const message =
    retryAfterSeconds === undefined
      ? (detail ?? fallback)
      : rateLimitMessage(retryAfterSeconds);
  return new ApiError(response.status, message, fieldErrors, retryAfterSeconds);
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  {
    renewSessionOn401 = !PATHS_WITHOUT_SESSION_RENEWAL.includes(path),
  }: RequestOptions = {},
): Promise<T> {
  let response = await send(path, init);

  if (response.status === 401 && renewSessionOn401) {
    const renewal = await renewSession();
    if (renewal.renewed) {
      response = await send(path, init);
    } else if (renewal.rateLimited) {
      // Limite de tentativas de renovação: a sessão continua válida, o usuário só precisa esperar.
      throw new ApiError(
        429,
        rateLimitMessage(renewal.retryAfterSeconds),
        {},
        renewal.retryAfterSeconds,
      );
    } else {
      tokenStore.clear();
      onSessionExpired(SESSION_EXPIRED_MESSAGE);
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
    }
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'GET' }, options),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
