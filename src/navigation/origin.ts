/**
 * A lista de onde o professor abriu o perfil de um aluno, guardada no estado da navegação para o
 * "Voltar" e o menu a restaurarem, com a página e o filtro. Só as duas listas valem: qualquer
 * outro valor é ignorado, para o estado de uma navegação não levar a lugar nenhum.
 */
const ORIGIN_PATTERN = /^\/professor\/(solicitacoes|orientandos)(\?[^#]*)?$/;

export function originState(location: { pathname: string; search: string }) {
  return { from: `${location.pathname}${location.search}` };
}

export function originPath(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const { from } = state as { from?: unknown };
  return typeof from === 'string' && ORIGIN_PATTERN.test(from) ? from : null;
}

/** O caminho da origem, sem a query. */
export function originPathname(state: unknown): string | null {
  return originPath(state)?.split('?')[0] ?? null;
}
