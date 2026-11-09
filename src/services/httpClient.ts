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

/** Quem leva o pedido à rede: `fetch`, ou o `XMLHttpRequest` do envio com progresso. */
type Sender = (path: string, init: RequestInit) => Promise<Response>;

function authorizedHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

const send: Sender = async (path, init) => {
  const headers = authorizedHeaders(init);
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
};

/**
 * O envio de um formulário com o progresso do upload, que o `fetch` não informa. O navegador
 * acrescenta o Content-Type do multipart, com o limite das partes: por isso ele não é fixado.
 */
function sendWithProgress(onProgress: (percent: number) => void): Sender {
  return (path, init) =>
    new Promise<Response>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(init.method ?? 'POST', `${API_BASE_URL}${path}`);
      authorizedHeaders(init).forEach((value, name) =>
        request.setRequestHeader(name, value),
      );
      request.withCredentials = true;
      onProgress(0);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.floor((event.loaded / event.total) * 100));
        }
      };
      request.onload = () => {
        const retryAfter = request.getResponseHeader('Retry-After');
        resolve(
          new Response(request.responseText || null, {
            status: request.status,
            headers:
              retryAfter === null ? undefined : { 'Retry-After': retryAfter },
          }),
        );
      };
      request.onerror = () => reject(new ApiError(0, messageForStatus(0)));
      request.send(init.body as XMLHttpRequestBodyInit);
    });
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

/**
 * O núcleo de todo pedido autenticado: renova o token uma vez num 401 e repete, e devolve a
 * resposta bem-sucedida ou falha com o `ApiError` do servidor.
 */
async function execute(
  sender: Sender,
  path: string,
  init: RequestInit,
  renewSessionOn401: boolean,
): Promise<Response> {
  let response = await sender(path, init);

  if (response.status === 401 && renewSessionOn401) {
    const renewal = await renewSession();
    if (renewal.renewed) {
      response = await sender(path, init);
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
  return response;
}

async function jsonBodyOf<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  {
    renewSessionOn401 = !PATHS_WITHOUT_SESSION_RENEWAL.includes(path),
  }: RequestOptions = {},
): Promise<T> {
  return jsonBodyOf<T>(await execute(send, path, init, renewSessionOn401));
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'GET' }, options),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** Envia um formulário (multipart) informando o progresso do upload, de 0 a 100. */
  upload: async <T>(
    path: string,
    body: FormData,
    onProgress: (percent: number) => void,
  ) =>
    jsonBodyOf<T>(
      await execute(
        sendWithProgress(onProgress),
        path,
        { method: 'POST', body },
        true,
      ),
    ),
  /** Baixa o conteúdo de um arquivo por requisição autenticada, para quem o guardará. */
  download: async (path: string): Promise<Blob> =>
    (await execute(send, path, { method: 'GET' }, true)).blob(),
};
