import { useState } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useLoad } from '../hooks/useLoad';
import { listAdvisees } from '../services/adviseeService';
import type { AdviseePage } from '../services/adviseeService';

const SEARCH_PAUSE_MS = 400;

export interface AdviseeChoice {
  id: number;
  name: string;
  /** O tema do TCC, ou `null` quando o orientando ainda não tem (RN12). */
  thesisTopic: string | null;
}

/**
 * Os orientandos do professor que casam com o texto digitado, buscados no servidor depois de uma
 * pausa na digitação (RN32: nome e tema, sem matrícula). A última leitura fica guardada, para a
 * lista não esvaziar enquanto a próxima busca chega.
 */
export function useAdviseeSearch(text: string) {
  const search = useDebouncedValue(text.trim(), SEARCH_PAUSE_MS);
  const load = useLoad(() => listAdvisees(1, search), search);
  const [last, setLast] = useState<AdviseePage | null>(null);
  if (load.status === 'ready' && load.data !== last) setLast(load.data);
  const options: AdviseeChoice[] = (last?.items ?? []).map((advisee) => ({
    id: advisee.student.id,
    name: advisee.student.fullName,
    thesisTopic: advisee.thesisTopic,
  }));
  return {
    options,
    total: last?.count ?? 0,
    loading: load.status === 'loading',
    failed: load.status === 'error',
  };
}
