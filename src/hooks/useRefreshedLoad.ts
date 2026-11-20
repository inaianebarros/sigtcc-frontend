import { useState } from 'react';
import { useLastReady } from './useLastReady';
import { useLoad } from './useLoad';
import type { LoadState } from './useLoad';
import { usePolling } from './usePolling';
import { useSession } from './useSession';

/** De quanto em quanto tempo uma tela aberta relê os próprios dados (ADR frontend 0006). */
export const REFRESH_INTERVAL_MS = 30_000;

/**
 * Uma leitura que a tela refaz sozinha a cada 30 s com a aba visível e na hora em que a pessoa
 * volta para a aba (ADR frontend 0006). O ciclo é o de `usePolling`: pausa com a aba oculta e
 * para ao desmontar ou sem sessão.
 *
 * Só a primeira leitura de cada `key` (página, filtros) e o `retry` mostram o carregamento ou o
 * erro. A releitura em segundo plano não: enquanto corre, e se falhar, `state` continua `ready`
 * com os dados já na tela, e o ciclo seguinte tenta de novo. Uma releitura só começa quando a
 * anterior terminou, e só se já há dados da `key` atual na tela.
 *
 * Os dados novos chegam como um objeto novo; a tela os renderiza com as mesmas `key`s de lista,
 * e o React troca só o que mudou: foco, rolagem, itens abertos e formulários ficam como estão.
 *
 * Com `key` nula não há o que ler, como em `useLoad`: o estado é `idle` e o ciclo não roda.
 */
export function useRefreshedLoad<T>(
  load: () => Promise<T>,
  key: string | number | null = '',
): {
  state: LoadState<T>;
  retry: () => void;
} {
  const { status } = useSession();
  const [reads, setReads] = useState(0);
  const [backgroundRead, setBackgroundRead] = useState<string | null>(null);
  const readKey = key === null ? null : `${key}|${reads}`;
  const result = useLoad(load, readKey);
  const kept = useLastReady(result);
  const inBackground =
    readKey !== null && backgroundRead === readKey && kept !== null;

  usePolling(
    () => {
      // A releitura que falhou em segundo plano deixa os dados da mesma key na tela e pode ser
      // tentada de novo; qualquer outra leitura em curso ou com erro espera.
      const settledWithData =
        result.status === 'ready' ||
        (result.status === 'error' && inBackground);
      if (!settledWithData) return;
      const next = reads + 1;
      setReads(next);
      setBackgroundRead(`${key}|${next}`);
    },
    {
      intervalMs: REFRESH_INTERVAL_MS,
      enabled: status === 'authenticated' && key !== null,
      pollOnStart: false,
    },
  );

  const state: LoadState<T> =
    inBackground && result.status !== 'ready'
      ? { status: 'ready', data: kept }
      : result;
  return { state, retry: () => setReads((count) => count + 1) };
}
