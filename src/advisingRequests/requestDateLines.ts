import { formatShortDate } from '../formatters/dateTime';
import type { MyRequestItem } from '../services/advisorService';

/** As linhas de datas de uma solicitação, em dd/mm/aaaa, conforme a situação. */
export function requestDateLines(request: MyRequestItem): string[] {
  const lines = [`Enviada em ${formatShortDate(request.requestedAt)}`];
  const { advising } = request;
  switch (request.status) {
    case 'pending':
      if (request.expiresAt) {
        lines.push(
          `Pode ser respondida até ${formatShortDate(request.expiresAt)}`,
        );
      }
      break;
    case 'accepted':
      if (request.respondedAt) {
        lines.push(`Aceita em ${formatShortDate(request.respondedAt)}`);
      }
      if (advising?.status === 'ended' && advising.endedAt) {
        lines.push(
          `Orientação de ${formatShortDate(advising.startedAt)} a ${formatShortDate(advising.endedAt)}`,
        );
      }
      break;
    case 'rejected':
      if (request.respondedAt) {
        lines.push(`Recusada em ${formatShortDate(request.respondedAt)}`);
      }
      break;
    case 'unanswered':
      lines.push('Sem resposta do professor');
      break;
  }
  return lines;
}
