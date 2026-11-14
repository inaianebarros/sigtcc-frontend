import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, messageForStatus } from '../services/apiError';
import { listTimeline } from '../services/activityTimelineService';
import type { TimelineEvent } from '../services/activityTimelineService';

export type TimelineState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      /** Do evento de índice mais alto para o mais baixo. */
      items: TimelineEvent[];
      /** O total de eventos da atividade. */
      count: number;
      /** Ainda há eventos de índice menor que o último carregado. */
      hasMore: boolean;
    };

function errorState(error: unknown): TimelineState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.message : messageForStatus(0),
  };
}

/**
 * A janela da linha do tempo de uma atividade (RF30): abre nos eventos mais recentes e cresce para
 * trás, de 10 em 10. `reload` relê o primeiro trecho e mantém os eventos mais antigos já
 * carregados, para o evento novo aparecer no topo sem perder o que foi rolado.
 */
export function useActivityTimeline(activityId: number) {
  const [state, setState] = useState<TimelineState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setMoreFailed(false);
    try {
      const first = await listTimeline(activityId);
      setState({ status: 'ready', ...first });
    } catch (error) {
      setState(errorState(error));
    }
  }, [activityId]);

  useEffect(() => {
    let active = true;
    listTimeline(activityId).then(
      (first) => {
        if (active) setState({ status: 'ready', ...first });
      },
      (error: unknown) => {
        if (active) setState(errorState(error));
      },
    );
    return () => {
      active = false;
    };
  }, [activityId]);

  /** Relê o primeiro trecho: o evento novo entra no topo, e os anteriores já carregados ficam. */
  const reload = useCallback(async () => {
    const fresh = await listTimeline(activityId);
    setState((current) => {
      const lowest = fresh.items.at(-1)?.index ?? 0;
      if (current.status !== 'ready' || lowest <= 1) {
        return { status: 'ready', ...fresh };
      }
      const kept = current.items.filter((item) => item.index < lowest);
      return {
        status: 'ready',
        items: [...fresh.items, ...kept],
        count: fresh.count,
        hasMore: kept.length > 0 ? current.hasMore : fresh.hasMore,
      };
    });
  }, [activityId]);

  /** Traz os 10 eventos anteriores ao último carregado e os põe depois dele. */
  const loadMore = useCallback(async () => {
    if (state.status !== 'ready' || !state.hasMore || busy.current) return;
    const before = state.items.at(-1)?.index;
    if (before === undefined) return;
    busy.current = true;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const older = await listTimeline(activityId, { before });
      setState((now) => {
        if (now.status !== 'ready') return now;
        const known = new Set(now.items.map((item) => item.index));
        return {
          status: 'ready',
          items: [
            ...now.items,
            ...older.items.filter((item) => !known.has(item.index)),
          ],
          count: older.count,
          hasMore: older.hasMore,
        };
      });
    } catch {
      setMoreFailed(true);
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [activityId, state]);

  return { state, load, reload, loadMore, loadingMore, moreFailed };
}
