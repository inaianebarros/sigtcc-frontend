import { useState } from 'react';
import { useLoad } from '../hooks/useLoad';
import { listAdvisees } from '../services/adviseeService';

export interface AdviseeOption {
  id: number;
  name: string;
}

interface Loaded {
  options: AdviseeOption[];
  count: number;
}

async function loadUpTo(pages: number): Promise<Loaded> {
  const options: AdviseeOption[] = [];
  let count = 0;
  for (let page = 1; page <= pages; page += 1) {
    const result = await listAdvisees(page);
    count = result.count;
    options.push(
      ...result.items.map((item) => ({
        id: item.student.id,
        name: item.student.fullName,
      })),
    );
  }
  return { options, count };
}

/**
 * Os orientandos do professor, carregados por páginas para o campo de seleção do aluno: cada
 * "carregar mais" pede mais uma página. A última leitura completa fica guardada, para a lista
 * não esvaziar enquanto a próxima página chega.
 */
export function useAdviseeOptions(preselected: AdviseeOption | null) {
  const [pages, setPages] = useState(1);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const load = useLoad(() => loadUpTo(pages), pages);
  if (load.status === 'ready' && load.data !== loaded) setLoaded(load.data);
  const options = loaded?.options ?? [];
  // O aluno que veio do cartão pode estar além da primeira página: ele entra na lista mesmo assim.
  const withPreselected =
    preselected && !options.some((option) => option.id === preselected.id)
      ? [preselected, ...options]
      : options;
  return {
    options: withPreselected,
    loading: load.status === 'loading',
    failed: load.status === 'error',
    hasMore: loaded !== null && loaded.options.length < loaded.count,
    loadMore: () => setPages((current) => current + 1),
  };
}
