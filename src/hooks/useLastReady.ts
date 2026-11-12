import { useState } from 'react';
import type { LoadState } from './useLoad';

/**
 * O último dado que chegou de uma leitura, `null` antes do primeiro. Enquanto a próxima leitura
 * carrega, quem usa continua mostrando o anterior: uma lista paginada não some no meio da troca
 * de página, e o botão usado para trocar continua na tela, com o foco.
 */
export function useLastReady<T>(load: LoadState<T>): T | null {
  const [last, setLast] = useState<T | null>(null);
  if (load.status === 'ready' && load.data !== last) setLast(load.data);
  return last;
}
