import { useCallback, useEffect, useRef, useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { REFRESH_INTERVAL_MS } from '../hooks/useRefreshedLoad';
import { useSession } from '../hooks/useSession';
import { ApiError, messageForStatus } from '../services/apiError';
import {
  listTimeline,
  TIMELINE_PAGE_SIZE,
} from '../services/activityTimelineService';
import type {
  TimelineEvent,
  TimelinePage,
} from '../services/activityTimelineService';

// O maior `limit` que a API aceita, para trazer de uma vez os eventos entre o trecho novo e os
// que já estavam na tela.
const MAX_LIMIT = 100;
// Quantas leituras a mais a releitura faz para cobrir esse intervalo antes de desistir dele e
// mostrar só o trecho mais recente.
const MAX_BRIDGE_READS = 5;

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

/** O trecho relido e o menor índice que ele cobre: os eventos a partir dele são os relidos. */
interface FreshPart {
  page: TimelinePage;
  /** `null`: não foi possível cobrir até os eventos já na tela, e o trecho relido os substitui. */
  coveredFrom: number | null;
}

/**
 * Lê os eventos mais recentes e, se desde a última leitura surgiram mais eventos que cabem num
 * trecho, também os do meio, até encostar no mais recente já na tela (`newestLoaded`): sem eles, a
 * lista teria um buraco. Os índices do servidor são contínuos; a cobertura sai deles, e não dos
 * eventos devolvidos, porque a tela descarta os de tipo desconhecido.
 */
async function readNewest(
  activityId: number,
  newestLoaded: number | undefined,
): Promise<FreshPart> {
  const first = await listTimeline(activityId);
  let coveredFrom = Math.max(1, first.count - TIMELINE_PAGE_SIZE + 1);
  if (newestLoaded === undefined) return { page: first, coveredFrom };
  const items = [...first.items];
  let hasMore = first.hasMore;
  for (let read = 0; read < MAX_BRIDGE_READS; read++) {
    if (coveredFrom <= newestLoaded + 1 || !hasMore) {
      return { page: { items, count: first.count, hasMore }, coveredFrom };
    }
    const limit = Math.min(MAX_LIMIT, coveredFrom - newestLoaded - 1);
    const bridge = await listTimeline(activityId, {
      before: coveredFrom,
      limit,
    });
    items.push(...bridge.items);
    hasMore = bridge.hasMore;
    coveredFrom = Math.max(1, coveredFrom - limit);
  }
  return coveredFrom <= newestLoaded + 1
    ? { page: { items, count: first.count, hasMore }, coveredFrom }
    : { page: first, coveredFrom: null };
}

/**
 * Junta o trecho relido aos eventos já na tela: os relidos valem (entram no topo e trazem a versão
 * nova dos que já estavam), e os mais antigos que eles ficam. Uma revisão ou uma entrega nova
 * encerra a espera de qualquer entrega anterior, que pode estar fora do trecho relido.
 */
function merged(now: TimelineState, fresh: FreshPart): TimelineState {
  const { page, coveredFrom } = fresh;
  if (now.status !== 'ready' || coveredFrom === null || coveredFrom <= 1) {
    return { status: 'ready', ...page };
  }
  const settled = page.items.some(
    (item) => item.type === 'review' || item.type === 'delivery',
  );
  const kept = now.items
    .filter((item) => item.index < coveredFrom)
    .map((item) =>
      settled && item.type === 'delivery' && item.awaitingReview
        ? { ...item, awaitingReview: false }
        : item,
    );
  return {
    status: 'ready',
    items: [...page.items, ...kept],
    count: page.count,
    hasMore: kept.length > 0 ? now.hasMore : page.hasMore,
  };
}

/**
 * A janela da linha do tempo de uma atividade (RF30): abre nos eventos mais recentes e cresce para
 * trás, de 10 em 10. `reload` relê o primeiro trecho e mantém os eventos mais antigos já
 * carregados, para o evento novo aparecer no topo sem perder o que foi rolado; a mesma releitura
 * roda sozinha a cada 30 s com a aba visível (ADR frontend 0006).
 */
export function useActivityTimeline(activityId: number) {
  const [state, setState] = useState<TimelineState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const busy = useRef(false);
  // A atividade cujos resultados ainda valem: uma resposta tardia de outra é descartada.
  const current = useRef(activityId);
  useEffect(() => {
    current.current = activityId;
  }, [activityId]);

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

  // Os eventos já na tela, para a releitura saber até onde preencher o que faltar.
  const loaded = useRef<TimelineEvent[]>([]);
  useEffect(() => {
    loaded.current = state.status === 'ready' ? state.items : [];
  }, [state]);

  /** Relê o primeiro trecho: o evento novo entra no topo, e os anteriores já carregados ficam. */
  const reload = useCallback(async () => {
    setReloadFailed(false);
    try {
      const fresh = await readNewest(activityId, loaded.current[0]?.index);
      if (current.current !== activityId) return;
      setState((now) => merged(now, fresh));
    } catch {
      // O que já está na tela continua; o aviso deixa tentar de novo.
      if (current.current === activityId) setReloadFailed(true);
    }
  }, [activityId]);

  // A releitura a cada 30 s com a aba visível (ADR frontend 0006): traz os comentários, entregas e
  // revisões da outra parte sem esqueleto. Uma falha aqui não é avisada; o ciclo seguinte tenta de
  // novo. Uma releitura só começa quando a anterior terminou.
  const { status: sessionStatus } = useSession();
  const polling = useRef(false);
  usePolling(
    () => {
      if (polling.current) return;
      polling.current = true;
      readNewest(activityId, loaded.current[0]?.index)
        .then(
          (fresh) => {
            if (current.current === activityId) {
              setState((now) => merged(now, fresh));
            }
          },
          () => {
            // Em segundo plano a falha não é avisada: a tela fica como está até o próximo ciclo.
          },
        )
        .finally(() => {
          polling.current = false;
        });
    },
    {
      intervalMs: REFRESH_INTERVAL_MS,
      enabled: sessionStatus === 'authenticated' && state.status === 'ready',
      pollOnStart: false,
    },
  );

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
      if (current.current !== activityId) return;
      setState((now) => {
        if (now.status !== 'ready') return now;
        const known = new Set(now.items.map((item) => item.index));
        return {
          status: 'ready',
          items: [
            ...now.items,
            ...older.items.filter((item) => !known.has(item.index)),
          ],
          count: Math.max(now.count, older.count),
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

  return {
    state,
    load,
    reload,
    reloadFailed,
    loadMore,
    loadingMore,
    moreFailed,
  };
}
