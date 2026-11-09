import { formatDeadline } from '../formatters/dateTime';
import { activityPath, paths } from '../navigation/paths';
import type { AppNotification } from '../services/notificationService';

export type NotificationGroup = 'advising' | 'activity' | 'meeting' | 'other';

const GROUPS: Record<string, NotificationGroup> = {
  advising_request_received: 'advising',
  advising_request_answered: 'advising',
  advising_request_unanswered: 'advising',
  advising_ended: 'advising',
  activity_created: 'activity',
  activity_changed: 'activity',
  activity_deleted: 'activity',
  activity_commented: 'activity',
  activity_submitted: 'activity',
  activity_awaiting_review: 'activity',
  activity_review_result: 'activity',
  meeting_requested: 'meeting',
  meeting_answered: 'meeting',
};

/** O grupo do tipo, para o ícone; um tipo que esta versão da tela não conhece cai em "other". */
export function groupOf(type: string): NotificationGroup {
  return GROUPS[type] ?? 'other';
}

const ACTIVITY_WITH_DESTINATION = new Set([
  'activity_created',
  'activity_changed',
  'activity_commented',
  'activity_submitted',
  'activity_awaiting_review',
  'activity_review_result',
]);

/**
 * Para onde a notificação leva, ou `null` quando não há destino: a atividade excluída (RF52), uma
 * referência que falta e um tipo desconhecido. Um destino que deixou de existir mostra a mensagem
 * da própria tela.
 */
export function destinationOf(
  notification: AppNotification,
  userType: 'student' | 'teacher',
): string | null {
  const { type, reference } = notification;
  if (type === 'advising_request_received') return paths.teacherRequests;
  if (
    type === 'advising_request_answered' ||
    type === 'advising_request_unanswered' ||
    type === 'advising_ended'
  ) {
    return paths.studentRequest;
  }
  if (type === 'meeting_requested' || type === 'meeting_answered') {
    return userType === 'student'
      ? paths.studentMeetings
      : paths.teacherMeetings;
  }
  if (ACTIVITY_WITH_DESTINATION.has(type) && reference !== null) {
    return activityPath(userType, reference.id);
  }
  return null;
}

/** Uma linha de detalhe do `payload`: um campo alterado (RF52) ou uma quantidade (RF53). */
export type NotificationDetail =
  | { kind: 'change'; field: string; oldValue: string; newValue: string }
  | { kind: 'count'; label: string; value: number };

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descrição',
  deadline: 'Prazo',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function changeFrom(item: unknown): NotificationDetail | null {
  if (!isRecord(item)) return null;
  const { field, old, new: updated } = item;
  if (typeof field !== 'string' || !(field in FIELD_LABELS)) return null;
  if (typeof old !== 'string' || typeof updated !== 'string') return null;
  const show = field === 'deadline' ? formatDeadline : (text: string) => text;
  return {
    kind: 'change',
    field: FIELD_LABELS[field]!,
    oldValue: show(old),
    newValue: show(updated),
  };
}

function countsFrom(payload: Record<string, unknown>): NotificationDetail[] {
  const details: NotificationDetail[] = [];
  const { archived_activities: archived, cancelled_meetings: cancelled } =
    payload;
  if (typeof archived === 'number') {
    details.push({
      kind: 'count',
      label: 'Atividades arquivadas',
      value: archived,
    });
  }
  if (typeof cancelled === 'number') {
    details.push({
      kind: 'count',
      label: 'Reuniões canceladas',
      value: cancelled,
    });
  }
  return details;
}

/**
 * Os detalhes que o `payload` traz além da mensagem: os campos alterados de uma atividade (RF52)
 * e as quantidades da orientação encerrada (RF53). Um payload que não tem a forma esperada, ou de
 * um tipo sem detalhes, dá uma lista vazia: ele nunca quebra a tela.
 */
export function detailsOf(notification: AppNotification): NotificationDetail[] {
  const { type, payload } = notification;
  if (type === 'activity_changed') {
    const { changes } = payload;
    if (!Array.isArray(changes)) return [];
    return changes.flatMap((item) => changeFrom(item) ?? []);
  }
  if (type === 'advising_ended') return countsFrom(payload);
  return [];
}
