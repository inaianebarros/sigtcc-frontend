export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    message: string,
    fieldErrors: FieldErrors = {},
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/** Escreve um tempo de espera em segundos, minutos ou horas, sempre arredondando para cima. */
export function waitTimeText(seconds: number): string {
  const wholeSeconds = Math.ceil(seconds);
  if (wholeSeconds < SECONDS_PER_MINUTE) return plural(wholeSeconds, 'segundo');
  const minutes = Math.ceil(wholeSeconds / SECONDS_PER_MINUTE);
  if (minutes < SECONDS_PER_MINUTE) return plural(minutes, 'minuto');
  return plural(Math.ceil(wholeSeconds / SECONDS_PER_HOUR), 'hora');
}

/** Mensagem do 429: com o tempo de espera quando o servidor o informa, sem ele caso contrário. */
export function rateLimitMessage(retryAfterSeconds?: number): string {
  if (
    retryAfterSeconds === undefined ||
    !Number.isFinite(retryAfterSeconds) ||
    retryAfterSeconds <= 0
  ) {
    return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.';
  }
  return `Muitas tentativas. Tente novamente em ${waitTimeText(retryAfterSeconds)}.`;
}

export const INVALID_FORM_MESSAGE = 'Verifique os campos do formulário.';

export function fieldErrorsFrom(detail: unknown[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const item of detail) {
    if (typeof item !== 'object' || item === null) continue;
    if (!('loc' in item) || !('msg' in item)) continue;
    const { loc, msg } = item;
    if (!Array.isArray(loc) || typeof msg !== 'string') continue;
    const field = String(loc.at(-1));
    errors[field] ??= msg;
  }
  return errors;
}

export const SESSION_EXPIRED_MESSAGE =
  'Sua sessão expirou por inatividade. Faça login novamente.';

export function messageForStatus(status: number): string {
  if (status === 0) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }
  if (status === 401) return SESSION_EXPIRED_MESSAGE;
  if (status === 403) return 'Você não tem permissão para realizar esta ação.';
  if (status === 429) return rateLimitMessage();
  if (status === 404) return 'O recurso solicitado não foi encontrado.';
  if (status >= 500) {
    return 'Ocorreu um erro no servidor. Tente novamente em instantes.';
  }
  return 'Não foi possível concluir a solicitação.';
}
