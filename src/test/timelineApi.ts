import type { FakeActivity } from './activitiesApi';
import type { FakeComment } from './commentsApi';

export type FakeAuthor = {
  id: number;
  full_name: string;
  type: 'student' | 'teacher';
};

/** Um evento sem registro próprio no estado da atividade: mudança de situação e envio. */
export interface FakeLogEvent {
  type: 'status_change' | 'sent_for_review';
  status?: 'pending' | 'in_progress';
  occurred_at: string;
  author?: FakeAuthor;
}

type FakeFile = {
  id: number;
  file_name: string;
  size_bytes: number;
  content_type: string;
};

interface RawTimelineEvent {
  type: string;
  id: number;
  occurred_at: string;
  author: FakeAuthor;
  [extra: string]: unknown;
}

export type FakeTimelineEvent = RawTimelineEvent & { index: number };

/**
 * A linha do tempo como o servidor a monta: os registros da atividade (criação, entregas,
 * avaliações, comentários e o log de situação) em ordem de instante, numerados de 1 em diante.
 */
export function buildTimeline(
  activity: FakeActivity,
  comments: FakeComment[] = [],
): FakeTimelineEvent[] {
  const student: FakeAuthor = { ...activity.student, type: 'student' };
  const teacher: FakeAuthor = {
    ...(activity.teacher ?? { id: 9, full_name: 'Carlos Lima' }),
    type: 'teacher',
  };
  const lastReviewAt = activity.reviews.at(-1)?.decided_at ?? '';
  const lastSubmission = activity.submissions.at(-1);
  const raw: RawTimelineEvent[] = [
    {
      type: 'created',
      id: activity.id,
      occurred_at: activity.created_at,
      author: teacher,
    },
    ...activity.submissions.map((submission, position) => ({
      type: 'delivery',
      id: submission.id,
      occurred_at: submission.submitted_at,
      author: student,
      version: position + 1,
      files: submission.files as FakeFile[],
      awaiting_review:
        submission === lastSubmission &&
        activity.status === 'in_review' &&
        lastReviewAt < submission.submitted_at,
    })),
    ...activity.reviews.map((review) => ({
      type: 'review',
      id: review.id,
      occurred_at: review.decided_at,
      author: teacher,
      decision: review.decision,
      justification: review.justification ?? '',
      version: Math.max(
        1,
        activity.submissions.filter(
          (submission) => submission.submitted_at <= review.decided_at,
        ).length,
      ),
      files: review.files ?? [],
    })),
    ...(activity.events ?? []).map((event, position) => ({
      type: event.type,
      id: 1000 + position,
      occurred_at: event.occurred_at,
      author: event.author ?? student,
      ...(event.status ? { status: event.status } : {}),
    })),
    ...comments.map((comment) => ({
      type: 'comment',
      id: comment.id,
      occurred_at: comment.created_at,
      author: comment.author,
      text: comment.text,
    })),
  ];
  return raw
    .map((event, position) => ({ event, position }))
    .sort(
      (a, b) =>
        a.event.occurred_at.localeCompare(b.event.occurred_at) ||
        a.position - b.position,
    )
    .map(({ event }, position) => ({ ...event, index: position + 1 }));
}

/** Uma página como `GET /atividades/{id}/linha-do-tempo`: do índice mais alto para o mais baixo. */
export function timelinePage(
  events: FakeTimelineEvent[],
  url: URL,
): { items: FakeTimelineEvent[]; count: number; has_more: boolean } {
  const limit = Number(url.searchParams.get('limit') ?? 10);
  const beforeParam = url.searchParams.get('before');
  const before = beforeParam === null ? Infinity : Number(beforeParam);
  const older = events.filter((event) => event.index < before).reverse();
  return {
    items: older.slice(0, limit),
    count: events.length,
    has_more: older.length > limit,
  };
}
