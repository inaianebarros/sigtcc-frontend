import { useState } from 'react';
import type { LoadState } from './useLoad';

interface PagedData {
  items: unknown[];
  count: number;
}

/**
 * Os limites de uma lista paginada:
 * - `knownCount`, o total da última resposta, para a paginação continuar montada durante o
 *   carregamento (se ela sumisse, o botão usado deixaria de existir e o foco se perderia);
 * - `lastPage`, a última página que existe;
 * - `fallbackPage`, para onde voltar quando a página pedida ficou vazia porque a lista encolheu
 *   (ou veio de um link antigo), ou `null` se não há o que corrigir. Quem usa decide como
 *   voltar: na renderização, para um estado local, ou num efeito, para a URL.
 */
export function usePageBounds(
  list: LoadState<PagedData>,
  pageSize: number,
  page: number,
) {
  const [knownCount, setKnownCount] = useState(0);
  if (list.status === 'ready' && list.data.count !== knownCount) {
    setKnownCount(list.data.count);
  }
  const lastPage = Math.max(1, Math.ceil(knownCount / pageSize));
  const fallbackPage =
    list.status === 'ready' &&
    list.data.items.length === 0 &&
    list.data.count > 0 &&
    page > 1
      ? Math.min(page, Math.ceil(list.data.count / pageSize))
      : null;
  return { knownCount, lastPage, fallbackPage };
}
