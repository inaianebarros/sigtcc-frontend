import { useState } from 'react';
import type { LoadState } from './useLoad';

interface PagedData {
  items: unknown[];
  count: number;
}

/**
 * O total da última resposta, para a paginação continuar montada durante o carregamento (se
 * ela sumisse, o botão usado deixaria de existir e o foco se perderia), e a volta para a
 * última página que existe quando a página pedida ficou vazia porque a lista encolheu.
 */
export function usePageBounds(
  list: LoadState<PagedData>,
  pageSize: number,
  page: number,
  setPage: (page: number) => void,
) {
  const [knownCount, setKnownCount] = useState(0);
  if (list.status === 'ready' && list.data.count !== knownCount) {
    setKnownCount(list.data.count);
  }
  const lastPage = Math.max(1, Math.ceil(knownCount / pageSize));
  if (
    list.status === 'ready' &&
    list.data.items.length === 0 &&
    list.data.count > 0 &&
    page > 1
  ) {
    setPage(Math.min(page, Math.ceil(list.data.count / pageSize)));
  }
  return { knownCount, lastPage };
}
