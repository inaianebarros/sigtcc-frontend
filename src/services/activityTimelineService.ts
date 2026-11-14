import { fileFrom } from './activityService';
import type {
  ActivityStatus,
  ApiFile,
  ReviewDecision,
  SubmissionFile,
} from './activityService';
import { httpClient } from './httpClient';

/** Quantos eventos a linha do tempo traz por vez (RF30). */
export const TIMELINE_PAGE_SIZE = 10;

export type TimelineAuthorType = 'student' | 'teacher';

interface TimelineBase {
  /** O número do evento: 1 é a criação e o maior é o mais recente. Também a chave do cartão. */
  index: number;
  /** O id do registro de origem (o da revisão, no download de um anexo). */
  id: number;
  /** O instante com o fuso, como o servidor o devolve. */
  occurredAt: string;
  author: { id: number; fullName: string; type: TimelineAuthorType };
}

/** Um Evento da Atividade: o que aconteceu nela, na ordem em que o servidor o numerou. */
export type TimelineEvent = TimelineBase &
  (
    | { type: 'created' }
    | {
        type: 'delivery';
        version: number;
        files: SubmissionFile[];
        awaitingReview: boolean;
      }
    | {
        type: 'status_change';
        status: Extract<ActivityStatus, 'pending' | 'in_progress'>;
      }
    | { type: 'sent_for_review' }
    | { type: 'comment'; text: string }
    | {
        type: 'review';
        decision: ReviewDecision;
        justification: string;
        version: number;
        files: SubmissionFile[];
      }
  );

/** Um trecho da linha do tempo, do evento de índice mais alto para o mais baixo. */
export interface TimelinePage {
  items: TimelineEvent[];
  /** O total de eventos da atividade, que é o índice do mais recente. */
  count: number;
  /** Ainda há eventos de índice menor que o último devolvido. */
  hasMore: boolean;
}

interface ApiTimelineEvent {
  index: number;
  type: TimelineEvent['type'];
  id: number;
  occurred_at: string;
  author: { id: number; full_name: string; type: TimelineAuthorType };
  version?: number;
  files?: ApiFile[];
  awaiting_review?: boolean;
  status?: 'pending' | 'in_progress';
  text?: string;
  decision?: ReviewDecision;
  justification?: string;
}

/** O evento da API, ou `null` para um tipo que esta versão da tela não conhece. */
function eventFrom(event: ApiTimelineEvent): TimelineEvent | null {
  const base: TimelineBase = {
    index: event.index,
    id: event.id,
    occurredAt: event.occurred_at,
    author: {
      id: event.author.id,
      fullName: event.author.full_name,
      type: event.author.type,
    },
  };
  const files = (event.files ?? []).map(fileFrom);
  switch (event.type) {
    case 'delivery':
      return {
        ...base,
        type: 'delivery',
        version: event.version ?? 0,
        files,
        awaitingReview: event.awaiting_review ?? false,
      };
    case 'status_change':
      return {
        ...base,
        type: 'status_change',
        status: event.status ?? 'pending',
      };
    case 'comment':
      return { ...base, type: 'comment', text: event.text ?? '' };
    case 'review':
      return {
        ...base,
        type: 'review',
        decision: event.decision ?? 'rejected',
        justification: event.justification ?? '',
        version: event.version ?? 0,
        files,
      };
    case 'created':
    case 'sent_for_review':
      return { ...base, type: event.type };
    default:
      return null;
  }
}

/**
 * Lê um trecho da linha do tempo (RF30): sem `before`, os mais recentes; com ele, os de índice
 * menor que o do último evento já carregado.
 */
export async function listTimeline(
  activityId: number,
  {
    before,
    limit = TIMELINE_PAGE_SIZE,
  }: { before?: number; limit?: number } = {},
): Promise<TimelinePage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before !== undefined) params.set('before', String(before));
  const response = await httpClient.get<{
    items: ApiTimelineEvent[];
    count: number;
    has_more: boolean;
  }>(`/atividades/${activityId}/linha-do-tempo?${params}`);
  return {
    items: response.items
      .map(eventFrom)
      .filter((event): event is TimelineEvent => event !== null),
    count: response.count,
    hasMore: response.has_more,
  };
}
