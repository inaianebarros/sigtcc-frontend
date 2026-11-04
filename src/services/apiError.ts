export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
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
