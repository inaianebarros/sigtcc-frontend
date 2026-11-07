import type { LoadState } from '../hooks/useLoad';

/** O nome de um item do catálogo, ou um texto que explica por que ele não está disponível. */
export function catalogName(
  state: LoadState<{ id: number; name: string }[]>,
  id: number,
): string {
  if (state.status === 'error') return 'Não foi possível carregar.';
  if (state.status !== 'ready') return 'Carregando…';
  return state.data.find((item) => item.id === id)?.name ?? '—';
}
