import { answerMeeting, cancelMeeting } from '../services/meetingService';
import type { ReasonNoun } from './meetingForm';

export type ReasonActionKind = 'reject' | 'cancel';

interface ReasonAction {
  title: string;
  /** O que a ação faz e, se for o caso, que não tem volta (RNF21). */
  intro: string;
  noun: ReasonNoun;
  confirmLabel: string;
  sendingLabel: string;
  successMessage: string;
  send: (meetingId: number, reason: string) => Promise<void>;
}

/** O que muda entre recusar (justificativa, RN11) e cancelar (motivo, RN10): o resto é o mesmo diálogo. */
export const REASON_ACTIONS: Record<ReasonActionKind, ReasonAction> = {
  reject: {
    title: 'Recusar reunião',
    intro:
      'Explique à outra parte por que a reunião foi recusada. Depois de recusada, ela não pode ser alterada.',
    noun: 'justificativa',
    confirmLabel: 'Recusar',
    sendingLabel: 'Recusando…',
    successMessage: 'Reunião recusada.',
    send: (meetingId, reason) => answerMeeting(meetingId, 'reject', reason),
  },
  cancel: {
    title: 'Cancelar reunião',
    intro: 'Esta ação não pode ser desfeita. Informe o motivo do cancelamento.',
    noun: 'motivo',
    confirmLabel: 'Cancelar reunião',
    sendingLabel: 'Cancelando…',
    successMessage: 'Reunião cancelada.',
    send: (meetingId, reason) => cancelMeeting(meetingId, reason),
  },
};
