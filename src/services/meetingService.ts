import { httpClient } from './httpClient';

export const MEETINGS_PAGE_SIZE = 20;

export const MEETING_SITUATIONS = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'held',
  'expired',
] as const;
export type MeetingSituation = (typeof MEETING_SITUATIONS)[number];

export interface MeetingItem {
  id: number;
  /** O instante com o fuso, como o servidor o devolve. */
  scheduledAt: string;
  description: string;
  /** Derivada pelo servidor do status e do relógio (RN34 e glossário): a tela não a recalcula. */
  situation: MeetingSituation;
  author: { id: number; fullName: string; type: 'student' | 'teacher' };
  counterpart: { id: number; fullName: string };
  rejectionReason: string;
  cancellationReason: string;
  cancelledBySystem: boolean;
  /** As ações que o usuário pode fazer agora, calculadas no servidor (#37 e #38). */
  canAnswer: boolean;
  canEdit: boolean;
  canCancel: boolean;
}

export interface MeetingPage {
  items: MeetingItem[];
  count: number;
}

export interface MeetingFilters {
  page: number;
  situation: MeetingSituation | null;
  dateFrom: string | null;
  dateTo: string | null;
  studentId: number | null;
}

export interface MeetingInput {
  date: string;
  time: string;
  description: string;
}

interface ApiMeeting {
  id: number;
  scheduled_at: string;
  description: string;
  situation: MeetingSituation;
  author: { id: number; full_name: string; type: 'student' | 'teacher' };
  counterpart: { id: number; full_name: string };
  rejection_reason: string;
  cancellation_reason: string;
  cancelled_by_system: boolean;
  can_answer: boolean;
  can_edit: boolean;
  can_cancel: boolean;
}

function meetingFrom(item: ApiMeeting): MeetingItem {
  return {
    id: item.id,
    scheduledAt: item.scheduled_at,
    description: item.description,
    situation: item.situation,
    author: {
      id: item.author.id,
      fullName: item.author.full_name,
      type: item.author.type,
    },
    counterpart: {
      id: item.counterpart.id,
      fullName: item.counterpart.full_name,
    },
    rejectionReason: item.rejection_reason,
    cancellationReason: item.cancellation_reason,
    cancelledBySystem: item.cancelled_by_system,
    canAnswer: item.can_answer,
    canEdit: item.can_edit,
    canCancel: item.can_cancel,
  };
}

export async function listMeetings(
  filters: MeetingFilters,
): Promise<MeetingPage> {
  const params = new URLSearchParams({
    limit: String(MEETINGS_PAGE_SIZE),
    offset: String((filters.page - 1) * MEETINGS_PAGE_SIZE),
  });
  if (filters.situation) params.set('situation', filters.situation);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.studentId !== null)
    params.set('student_id', String(filters.studentId));
  const response = await httpClient.get<{ items: ApiMeeting[]; count: number }>(
    `/reunioes?${params}`,
  );
  return { count: response.count, items: response.items.map(meetingFrom) };
}

/**
 * O aluno solicita ao seu orientador (RF17) e o professor a um orientando (RF18, com o
 * `studentId`). O servidor valida o horário e a orientação e decide.
 */
export async function createMeeting(
  input: MeetingInput,
  studentId?: number,
): Promise<void> {
  await httpClient.post('/reunioes', {
    ...input,
    ...(studentId === undefined ? {} : { student_id: studentId }),
  });
}

export type AnswerAction = 'accept' | 'reject';

/**
 * A outra parte aceita ou recusa uma solicitação (RF20). A recusa leva a justificativa (RN11); o
 * servidor decide se a reunião ainda pode ser respondida.
 */
export async function answerMeeting(
  id: number,
  action: AnswerAction,
  reason?: string,
): Promise<void> {
  await httpClient.post(`/reunioes/${id}/responder`, {
    action,
    ...(reason === undefined ? {} : { reason }),
  });
}

/** Edição parcial pelo autor (RF21): só os campos que mudaram são enviados. */
export async function updateMeeting(
  id: number,
  changes: Partial<MeetingInput>,
): Promise<void> {
  await httpClient.patch(`/reunioes/${id}`, changes);
}

/** O cancelamento, com motivo (RF22, RN10); é definitivo. */
export async function cancelMeeting(id: number, reason: string): Promise<void> {
  await httpClient.post(`/reunioes/${id}/cancelar`, { reason });
}
