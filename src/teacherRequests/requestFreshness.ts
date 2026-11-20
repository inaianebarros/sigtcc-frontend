import type {
  AnswerAction,
  ReceivedRequest,
} from '../services/teacherRequestService';

/**
 * A solicitação saiu da página relida: ela pode ter sido respondida em outra aba, ter ficado sem
 * resposta no prazo (RN20) ou ter passado para outra página. Sem a versão nova não há como saber
 * se a resposta cabe, então o botão fica desabilitado, como nas Reuniões (ficha 18, caso c).
 */
export const REQUEST_GONE_MESSAGE =
  'Esta solicitação mudou de situação ou passou para outra página da lista. Feche e procure-a na lista para ver a situação atual.';

const PARTICIPLES: Record<AnswerAction, string> = {
  accept: 'aceita',
  reject: 'recusada',
};

/** Por que a resposta já não cabe, pela situação relida; `null` enquanto ela está pendente. */
function blockedMessage(
  action: AnswerAction,
  latest: ReceivedRequest,
): string | null {
  const participle = PARTICIPLES[action];
  switch (latest.status) {
    case 'pending':
      return null;
    case 'unanswered':
      // No Aceitar, a frase final diz o que ainda é possível (RN05); no Recusar não há o que fazer.
      return action === 'accept'
        ? 'O prazo para responder a esta solicitação foi encerrado, e ela não pode mais ser aceita. O aluno pode enviar uma nova solicitação.'
        : 'O prazo para responder a esta solicitação foi encerrado, e ela não pode mais ser recusada.';
    case 'accepted':
      return action === 'accept'
        ? 'Esta solicitação já foi aceita.'
        : `Esta solicitação foi aceita e não pode mais ser ${participle}.`;
    case 'rejected':
      return action === 'reject'
        ? 'Esta solicitação já foi recusada.'
        : `Esta solicitação foi recusada e não pode mais ser ${participle}.`;
    default:
      return null;
  }
}

/**
 * O aviso do diálogo de aceitar ou recusar aberto sobre `opened`, comparada com a mesma
 * solicitação na última leitura da lista (`undefined` se saiu da página ou do filtro). Toda mudança
 * que chega a este diálogo impede a resposta (RN06 e RN20): com aviso, o botão de confirmar fica
 * desabilitado. `null` enquanto ela continua pendente.
 */
export function noticeForAnswer(
  action: AnswerAction,
  opened: ReceivedRequest,
  latest: ReceivedRequest | undefined,
  now: number = Date.now(),
): string | null {
  if (latest !== undefined) return blockedMessage(action, latest);
  // Em "Pendentes", o filtro padrão, a que fica sem resposta no prazo sai da lista em vez de
  // mudar de situação: passado o prazo, ela não está mais pendente (RN20).
  const expired =
    opened.expiresAt !== null && Date.parse(opened.expiresAt) <= now;
  return expired
    ? blockedMessage(action, { ...opened, status: 'unanswered' })
    : REQUEST_GONE_MESSAGE;
}
