import type { MeetingItem } from '../services/meetingService';
import { SITUATIONS } from './situationDisplay';

/** O diálogo de formulário aberto sobre uma reunião, cada um ligado a uma flag `can_*`. */
export type MeetingFormAction = 'cancel' | 'reject' | 'edit' | 'notes';

/**
 * O aviso de um diálogo de formulário aberto quando a reunião muda na releitura (ADR frontend 0006,
 * ficha 18 de `docs/telas.md`). Com `blocksAction`, a ação já não cabe: o botão de confirmar fica
 * desabilitado, com o mesmo rótulo, e o aviso diz por quê.
 */
export interface MeetingNotice {
  message: string;
  blocksAction: boolean;
}

/** (c) no modal da reunião: ele continua com a última versão lida, só com "Fechar". */
export const MEETING_GONE_DETAILS_MESSAGE =
  'Esta reunião mudou de data ou de situação e saiu do período ou dos filtros do calendário. Estes são os últimos dados exibidos.';

/** (c) num diálogo de formulário: sem a versão nova não há como saber se a ação cabe. */
export const MEETING_GONE_FORM_MESSAGE =
  'Esta reunião mudou de data ou de situação e saiu do período ou dos filtros do calendário. Feche e encontre-a no calendário para continuar.';

/** Encerrar a orientação cancela as reuniões pendentes e aceitas (RN34). */
export const ADVISING_ENDED_MEETING_MESSAGE =
  'A orientação foi encerrada, e esta reunião foi cancelada.';

/** Encerrar a orientação congela os apontamentos (RN44). */
export const ADVISING_ENDED_NOTES_MESSAGE =
  'A orientação foi encerrada. Os apontamentos não podem mais ser alterados.';

// Os apontamentos não entram: a ficha não prevê aviso (a) nesse diálogo, só (b) e (c).
const PARTICIPLES: Record<Exclude<MeetingFormAction, 'notes'>, string> = {
  cancel: 'cancelada',
  reject: 'recusada',
  edit: 'editada',
};

// O formato do título do calendário, sem o ano: "quinta-feira, 26 de novembro".
const dayFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Santarem',
});
const hourFormat = new Intl.DateTimeFormat('pt-BR', {
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Santarem',
});

/** "14h" na hora cheia e "14h30" nas demais, no horário de Santarém. */
function hourOf(iso: string): string {
  const parts = hourFormat.formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return minute === '00' ? `${hour}h` : `${hour}h${minute}`;
}

function scheduleOf(meeting: MeetingItem): string {
  return `${dayFormat.format(new Date(meeting.scheduledAt))}, das ${hourOf(meeting.scheduledAt)} às ${hourOf(meeting.endsAt)}`;
}

function allows(action: MeetingFormAction, meeting: MeetingItem): boolean {
  switch (action) {
    case 'cancel':
      return meeting.canCancel;
    case 'reject':
      return meeting.canAnswer;
    case 'edit':
      return meeting.canEdit;
    case 'notes':
      return meeting.canEditNotes;
    default:
      return false;
  }
}

/** (a) A reunião mudou de data, hora ou situação. */
function changedMessage(latest: MeetingItem): string {
  const situation = SITUATIONS[latest.situation].label.toLowerCase();
  return `Esta reunião mudou. Agora é em ${scheduleOf(latest)}, e está ${situation}.`;
}

/** (b) Por que a ação já não cabe, pela situação relida. */
function blockedMessage(
  action: Exclude<MeetingFormAction, 'notes'>,
  latest: MeetingItem,
): string {
  const participle = PARTICIPLES[action];
  switch (latest.situation) {
    case 'cancelled':
      if (latest.cancelledBySystem) return ADVISING_ENDED_MEETING_MESSAGE;
      return action === 'cancel'
        ? 'Esta reunião já foi cancelada.'
        : `Esta reunião foi cancelada e não pode mais ser ${participle}.`;
    case 'rejected':
      return `Esta reunião foi recusada e não pode mais ser ${participle}.`;
    case 'held':
      return `Esta reunião já foi realizada e não pode mais ser ${participle}.`;
    case 'expired':
      return `O horário desta reunião passou sem resposta, e ela não pode mais ser ${participle}.`;
    case 'pending':
      // A aceita remarcada por quem a solicitou volta a pendente (RN39), e a outra parte só a recusa.
      if (action === 'cancel') {
        return `Esta reunião foi remarcada para ${scheduleOf(latest)}, e voltou a pendente. Agora você não pode cancelá-la, mas pode recusá-la pelo botão Recusar da reunião.`;
      }
      return changedMessage(latest);
    default:
      // Casos que a ficha diz não ocorrerem entre as duas partes (como a mesma pessoa agir em outra
      // aba): o aviso diz como a reunião está agora.
      return changedMessage(latest);
  }
}

/**
 * O aviso de um diálogo de formulário aberto sobre `opened`, comparado com a mesma reunião na última
 * leitura do calendário (`undefined` se ela saiu do período ou dos filtros). Decide pela situação e
 * pelas flags `can_*` relidas, que o servidor calcula; `null` quando não há o que avisar.
 */
export function noticeForForm(
  action: MeetingFormAction,
  opened: MeetingItem,
  latest: MeetingItem | undefined,
): MeetingNotice | null {
  if (latest === undefined) {
    return { message: MEETING_GONE_FORM_MESSAGE, blocksAction: true };
  }
  if (!allows(action, latest)) {
    return {
      message:
        action === 'notes'
          ? // Uma reunião realizada não muda de situação: só o encerramento tira os apontamentos.
            ADVISING_ENDED_NOTES_MESSAGE
          : blockedMessage(action, latest),
      blocksAction: true,
    };
  }
  if (action === 'notes') return null;
  if (
    action === 'edit' &&
    opened.situation === 'pending' &&
    latest.situation === 'accepted'
  ) {
    return {
      message:
        'Esta reunião foi aceita. Se você mudar a data ou o horário, ela volta a pendente e precisa ser aceita de novo.',
      blocksAction: false,
    };
  }
  if (
    opened.scheduledAt !== latest.scheduledAt ||
    opened.endsAt !== latest.endsAt ||
    opened.situation !== latest.situation
  ) {
    return { message: changedMessage(latest), blocksAction: false };
  }
  if (opened.description !== latest.description) {
    return {
      message: `A descrição desta reunião mudou: "${latest.description}".`,
      blocksAction: false,
    };
  }
  return null;
}
