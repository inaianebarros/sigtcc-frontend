import { useState } from 'react';

/**
 * A página escolhida vale só para os filtros atuais: se a chave mudar, volta à página 1.
 * Um filtro novo entra só na chave, sem tocar no resto.
 */
export function useFilteredPage(filterKey: string) {
  const [chosen, setChosen] = useState({ filterKey, page: 1 });
  if (chosen.filterKey !== filterKey) setChosen({ filterKey, page: 1 });
  const page = chosen.filterKey === filterKey ? chosen.page : 1;
  const setPage = (next: number) => setChosen({ filterKey, page: next });
  return [page, setPage] as const;
}
