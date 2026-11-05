export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
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
  if (status === 404) return 'O recurso solicitado não foi encontrado.';
  if (status >= 500) {
    return 'Ocorreu um erro no servidor. Tente novamente em instantes.';
  }
  return 'Não foi possível concluir a solicitação.';
}
