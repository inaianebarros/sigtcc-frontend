import type { BlockedReason } from '../services/advisorService';

export const UNKNOWN_BLOCK_MESSAGE =
  'No momento você não pode solicitar uma orientação.';

const BLOCKED_MESSAGES: Record<BlockedReason, string> = {
  active_advising:
    'Você já tem um orientador ativo, por isso não pode solicitar outra orientação agora.',
  pending_request:
    'Você já tem uma solicitação aguardando resposta, por isso não pode enviar outra agora.',
};

/** O texto do motivo que o servidor informou; sem motivo, uma frase neutra. */
export function blockedMessage(reason: BlockedReason | null): string {
  return reason ? BLOCKED_MESSAGES[reason] : UNKNOWN_BLOCK_MESSAGE;
}
