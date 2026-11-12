import { httpClient } from './httpClient';

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
  /** O término, no mesmo dia do início (RN45). */
  endsAt: string;
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

export interface MeetingInput {
  date: string;
  time: string;
  /** A hora de término (HH:MM), depois da de início e no mesmo dia (RN45). */
  endTime: string;
  description: string;
}

interface ApiMeeting {
  id: number;
  scheduled_at: string;
  ends_at: string;
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
    endsAt: item.ends_at,
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

/**
 * As reuniões do período exibido no calendário (RF19, RNF26): todas as do usuário entre duas
 * datas inclusivas (AAAA-MM-DD, no horário de Santarém), sem paginar e ordenadas pelo início. O
 * servidor aceita no máximo 42 dias, a grade de 6 semanas do Mês.
 */
export async function listMeetingsInPeriod(
  dateFrom: string,
  dateTo: string,
): Promise<MeetingItem[]> {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  const response = await httpClient.get<ApiMeeting[]>(
    `/reunioes/calendario?${params}`,
  );
  return response.map(meetingFrom);
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
    date: input.date,
    time: input.time,
    end_time: input.endTime,
    description: input.description,
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
  const { endTime, ...rest } = changes;
  await httpClient.patch(`/reunioes/${id}`, {
    ...rest,
    ...(endTime === undefined ? {} : { end_time: endTime }),
  });
}

/** O cancelamento, com motivo (RF22, RN10); é definitivo. */
export async function cancelMeeting(id: number, reason: string): Promise<void> {
  await httpClient.post(`/reunioes/${id}/cancelar`, { reason });
}
