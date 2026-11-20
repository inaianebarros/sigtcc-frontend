import { formatDeadline } from '../formatters/dateTime';
import type { ActivityDetail } from '../services/activityService';
import { STATUS_LABELS } from './activityStatus';

/** O diálogo aberto sobre uma atividade no Detalhe da atividade. */
export type ActivityDialogAction =
  'deliver' | 'sendForReview' | 'accept' | 'refuse' | 'edit' | 'delete';

/**
 * O aviso de um diálogo aberto quando a atividade muda na releitura (ADR frontend 0006). Com
 * `blocksAction`, a ação já não cabe: o botão de confirmar fica desabilitado, com o mesmo rótulo,
 * e o aviso diz por quê. O diálogo continua aberto, com o texto e os arquivos escolhidos.
 */
export interface ActivityNotice {
  message: string;
  blocksAction: boolean;
}

/**
 * A atividade sumiu: foi excluída ou a orientação foi encerrada, e o servidor responde o mesmo 404
 * para os dois casos (RN14). Vale nos diálogos e no erro de excluir (ficha 17 de `docs/telas.md`).
 */
export const ACTIVITY_GONE_MESSAGE =
  'Esta atividade não está mais disponível. Ela pode ter sido excluída, ou a orientação pode ter sido encerrada.';

/** O aluno entrega e envia para revisão só com a atividade pendente ou em andamento (RN15, RN16). */
function studentControls(activity: ActivityDetail): boolean {
  return activity.status === 'pending' || activity.status === 'in_progress';
}

/**
 * Se a ação ainda cabe na atividade relida. A API do detalhe não traz flags de permissão: a regra
 * é a mesma que o servidor aplica a cada ação (RN15, RN16, RN21), e ele continua decidindo no envio.
 */
function allows(action: ActivityDialogAction, latest: ActivityDetail): boolean {
  switch (action) {
    // O envio para revisão não exige entrega aqui: o diálogo só abre com ao menos uma, e as
    // entregas não são apagadas. O servidor recusa o envio se faltar, e o aviso não cai num texto
    // que não cabe ao caso.
    case 'deliver':
    case 'sendForReview':
      return studentControls(latest);
    case 'accept':
    case 'refuse':
      return latest.status === 'in_review';
    case 'edit':
    case 'delete':
      return latest.status !== 'completed';
    default:
      return false;
  }
}

/** Por que a ação já não cabe, pela situação relida. */
function blockedMessage(
  action: ActivityDialogAction,
  latest: ActivityDetail,
): string {
  const completed = latest.status === 'completed';
  switch (action) {
    case 'deliver':
      return completed
        ? 'Esta atividade foi concluída e não pode mais receber entregas.'
        : 'Esta atividade foi enviada para revisão. Enquanto ela é revisada, não é possível entregar arquivos.';
    case 'sendForReview':
      return completed
        ? 'Esta atividade foi concluída e não pode mais ser enviada para revisão.'
        : 'Esta atividade já foi enviada para revisão.';
    case 'accept':
      return completed
        ? 'Esta atividade já foi aceita.'
        : 'Esta atividade já foi recusada e devolvida ao aluno.';
    case 'refuse':
      return completed
        ? 'Esta atividade já foi aceita e não pode mais ser recusada.'
        : 'Esta atividade já foi recusada e devolvida ao aluno.';
    case 'edit':
      return 'Esta atividade foi concluída e não pode mais ser editada.';
    case 'delete':
      return 'Esta atividade foi concluída e não pode mais ser excluída.';
    default:
      return ACTIVITY_GONE_MESSAGE;
  }
}

/** Se chegou uma entrega que não existia quando o diálogo abriu. */
function hasNewSubmission(
  opened: ActivityDetail,
  latest: ActivityDetail,
): boolean {
  const openedIds = new Set(opened.submissions.map(({ id }) => id));
  return latest.submissions.some(({ id }) => !openedIds.has(id));
}

/** O que mudou numa atividade em que a ação ainda cabe; `null` se nada que a tela mostra mudou. */
function changedMessage(
  action: ActivityDialogAction,
  opened: ActivityDetail,
  latest: ActivityDetail,
): string | null {
  if (opened.status !== latest.status) {
    return `A situação desta atividade mudou para ${STATUS_LABELS[latest.status]}.`;
  }
  if (opened.deadline !== latest.deadline) {
    return `O prazo desta atividade mudou para ${formatDeadline(latest.deadline)}.`;
  }
  if (opened.title !== latest.title) {
    return `O título desta atividade mudou para "${latest.title}".`;
  }
  if (opened.description !== latest.description) {
    return 'A descrição desta atividade mudou.';
  }
  // A revisão foi recusada em outra aba e o aluno entregou de novo: a decisão passa a valer para a
  // nova entrega. As entregas não são apagadas, então a mais recente é a de número igual ao total.
  if (
    (action === 'accept' || action === 'refuse') &&
    hasNewSubmission(opened, latest)
  ) {
    return `Esta atividade recebeu a ${latest.submissions.length}ª entrega. A decisão vale para essa entrega, que está na linha do tempo.`;
  }
  return null;
}

/**
 * O aviso de um diálogo aberto sobre `opened`, comparada com a mesma atividade na última leitura do
 * detalhe: `null` em `latest` é a atividade que sumiu (404), e `undefined` é uma leitura ainda sem
 * resultado, que não avisa nada. Devolve `null` quando não há o que avisar.
 */
export function noticeForActivityDialog(
  action: ActivityDialogAction,
  opened: ActivityDetail,
  latest: ActivityDetail | null | undefined,
): ActivityNotice | null {
  if (latest === undefined) return null;
  if (latest === null) {
    return { message: ACTIVITY_GONE_MESSAGE, blocksAction: true };
  }
  if (!allows(action, latest)) {
    return { message: blockedMessage(action, latest), blocksAction: true };
  }
  const message = changedMessage(action, opened, latest);
  return message === null ? null : { message, blocksAction: false };
}
