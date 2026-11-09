import { useCallback, useEffect, useState } from 'react';
import { ApiError, messageForStatus } from '../services/apiError';
import { COMMENTS_PAGE_SIZE, listComments } from '../services/commentService';
import type { ActivityComment } from '../services/commentService';

export type CommentsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      items: ActivityComment[];
      count: number;
      /** Posição, na lista completa, do primeiro comentário carregado: acima dela há os anteriores. */
      start: number;
    };

function errorState(error: unknown): CommentsState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.message : messageForStatus(0),
  };
}

/**
 * A janela de comentários de uma atividade: abre na página mais recente, usando o total da resposta
 * (RF32), e cresce para trás, sem páginas. Não há tempo real: `refresh` relê a página mais recente
 * e mantém os anteriores que já estavam carregados.
 */
export function useComments(activityId: number) {
  const [state, setState] = useState<CommentsState>({ status: 'loading' });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderFailed, setOlderFailed] = useState(false);

  const fetchLatest = useCallback(async () => {
    const first = await listComments(activityId, {
      limit: COMMENTS_PAGE_SIZE,
      offset: 0,
    });
    if (first.count <= COMMENTS_PAGE_SIZE) {
      return { items: first.items, count: first.count, start: 0 };
    }
    const start = first.count - COMMENTS_PAGE_SIZE;
    const last = await listComments(activityId, {
      limit: COMMENTS_PAGE_SIZE,
      offset: start,
    });
    return { items: last.items, count: last.count, start };
  }, [activityId]);

  useEffect(() => {
    let active = true;
    fetchLatest().then(
      (latestSlice) => {
        if (active) setState({ status: 'ready', ...latestSlice });
      },
      (error: unknown) => {
        if (active) setState(errorState(error));
      },
    );
    return () => {
      active = false;
    };
  }, [fetchLatest]);

  /** A nova tentativa depois de uma falha ao abrir. */
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', ...(await fetchLatest()) });
    } catch (error) {
      setState(errorState(error));
    }
  }, [fetchLatest]);

  /** Relê a página mais recente e mantém os comentários anteriores já carregados. */
  const refresh = useCallback(async () => {
    const fresh = await fetchLatest();
    setState((current) => {
      if (current.status !== 'ready' || fresh.start <= current.start) {
        return { status: 'ready', ...fresh };
      }
      const kept = current.items.slice(0, fresh.start - current.start);
      return {
        status: 'ready',
        items: [...kept, ...fresh.items],
        count: fresh.count,
        start: current.start,
      };
    });
  }, [fetchLatest]);

  /** Põe no fim da lista o comentário que o usuário acabou de enviar. */
  const append = useCallback((comment: ActivityComment) => {
    setState((current) =>
      current.status === 'ready'
        ? {
            ...current,
            items: [...current.items, comment],
            count: current.count + 1,
          }
        : current,
    );
  }, []);

  /** Traz a página de comentários anteriores ao primeiro carregado e a põe antes dele. */
  const loadOlder = useCallback(async () => {
    if (state.status !== 'ready' || state.start === 0) return;
    const { start } = state;
    setLoadingOlder(true);
    setOlderFailed(false);
    try {
      const offset = Math.max(start - COMMENTS_PAGE_SIZE, 0);
      const older = await listComments(activityId, {
        limit: start - offset,
        offset,
      });
      setState((now) =>
        now.status === 'ready'
          ? {
              ...now,
              items: [...older.items, ...now.items],
              start: offset,
              count: older.count,
            }
          : now,
      );
    } catch {
      setOlderFailed(true);
    } finally {
      setLoadingOlder(false);
    }
  }, [activityId, state]);

  return {
    state,
    load,
    refresh,
    append,
    loadOlder,
    loadingOlder,
    olderFailed,
  };
}
