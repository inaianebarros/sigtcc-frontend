/**
 * A lista de onde a pessoa abriu um perfil, guardada no estado da navegação para o "Voltar" e o
 * menu a restaurarem, com a página e os filtros. Só as listas da própria área valem: qualquer
 * outro valor é ignorado, para o estado de uma navegação não levar a lugar nenhum.
 */
const ORIGIN_LISTS = {
  professor: ['solicitacoes', 'orientandos', 'atividades', 'historico'],
  aluno: ['orientadores', 'solicitacao', 'atividades', 'historico'],
} as const;

export type OriginArea = keyof typeof ORIGIN_LISTS;

const ORIGIN_PATTERNS = Object.fromEntries(
  Object.entries(ORIGIN_LISTS).map(([area, lists]) => [
    area,
    new RegExp(`^/${area}/(${lists.join('|')})(\\?[^#]*)?$`),
  ]),
) as Record<OriginArea, RegExp>;

export function originState(location: { pathname: string; search: string }) {
  return { from: `${location.pathname}${location.search}` };
}

/** A origem guardada no estado, se for uma lista da área `area`. */
export function originPath(state: unknown, area: OriginArea): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const { from } = state as { from?: unknown };
  if (typeof from !== 'string') return null;
  return ORIGIN_PATTERNS[area].test(from) ? from : null;
}

/** O caminho da origem, sem a query, de qualquer das áreas: é o que o menu compara com os itens. */
export function originPathname(state: unknown): string | null {
  const origin = originPath(state, 'professor') ?? originPath(state, 'aluno');
  return origin?.split('?')[0] ?? null;
}

const BACK_LABELS: Record<string, string> = {
  '/professor/orientandos': 'Voltar para meus orientandos',
  '/professor/solicitacoes': 'Voltar para as solicitações',
  '/professor/atividades': 'Voltar para as atividades',
  '/professor/historico': 'Voltar para o histórico',
  '/aluno/orientadores': 'Voltar para os orientadores',
  '/aluno/solicitacao': 'Voltar para minhas solicitações',
  '/aluno/atividades': 'Voltar para as atividades',
  '/aluno/historico': 'Voltar para o histórico',
};

/** O texto do "Voltar" de um perfil: diz para qual lista leva, e só "Voltar" quando não se sabe. */
export function backLabelFor(origin: string | null): string {
  const pathname = origin?.split('?')[0];
  return (pathname && BACK_LABELS[pathname]) || 'Voltar';
}
