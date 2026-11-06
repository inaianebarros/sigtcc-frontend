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
let refreshInFlight: Promise<boolean> | null = null;

export function setSessionExpiredHandler(
  handler: SessionExpiredHandler,
): () => void {
  onSessionExpired = handler;
  return () => {
    onSessionExpired = () => {};
  };
}

/** Único ponto de renovação do token (ADR frontend 0001: cookie httpOnly de refresh). */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}${REFRESH_PATH}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) return false;
    tokenStore.set(body.access_token);
    return true;
  } catch {
    return false;
  }
}

export function renewAccessToken(): Promise<boolean> {
  refreshInFlight ??= refreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
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

function retryAfterSecondsOf(response: Response): number | undefined {
  const header = response.headers.get('Retry-After');
  const seconds = header === null ? Number.NaN : Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
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
    if (await renewAccessToken()) {
      response = await send(path, init);
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
