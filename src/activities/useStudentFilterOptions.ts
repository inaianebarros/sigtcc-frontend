import { useState } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useLoad } from '../hooks/useLoad';
import { listAdvisees } from '../services/adviseeService';
import type { AdviseePage } from '../services/adviseeService';

const SEARCH_PAUSE_MS = 400;

export interface StudentOption {
  id: number;
  name: string;
}

interface Loaded {
  options: StudentOption[];
  count: number;
}

function optionsOf(page: AdviseePage): StudentOption[] {
  return page.items.map((item) => ({
    id: item.student.id,
    name: item.student.fullName,
  }));
}

/**
 * Os orientandos do professor para o filtro de aluno: a busca pelo nome é feita no servidor depois
 * de uma pausa na digitação, e `loadMore` junta a página seguinte à lista (rolagem infinita). Uma
 * busca nova recomeça da primeira página; a lista anterior fica à vista até a nova chegar. Nada é
 * lido enquanto `enabled` é falso.
 */
export function useStudentFilterOptions(text: string, enabled: boolean) {
  const search = useDebouncedValue(text.trim(), SEARCH_PAUSE_MS);
  const [request, setRequest] = useState({ search, page: 1 });
  if (request.search !== search) setRequest({ search, page: 1 });

  const load = useLoad(
    () => listAdvisees(request.page, request.search),
    enabled ? `${request.search}|${request.page}` : null,
  );

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [seen, setSeen] = useState<AdviseePage | null>(null);
  if (load.status === 'ready' && load.data !== seen) {
    setSeen(load.data);
    const next = optionsOf(load.data);
    setLoaded({
      options:
        request.page === 1 || loaded === null
          ? next
          : [...loaded.options, ...next],
      count: load.data.count,
    });
  }

  const hasMore =
    load.status === 'ready' &&
    loaded !== null &&
    loaded.options.length < loaded.count;
  return {
    options: loaded?.options ?? [],
    loading: load.status === 'loading',
    failed: load.status === 'error',
    hasMore,
    loadMore: () => {
      if (hasMore)
        setRequest((current) => ({ ...current, page: current.page + 1 }));
    },
  };
}
