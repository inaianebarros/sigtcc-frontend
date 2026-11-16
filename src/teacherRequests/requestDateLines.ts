import { formatShortDate } from '../formatters/dateTime';
import type { ReceivedRequest } from '../services/teacherRequestService';

/** As linhas de datas de uma solicitação recebida, em dd/mm/aaaa, conforme a situação. */
export function receivedRequestDateLines(request: ReceivedRequest): string[] {
  const lines = [`Enviada em ${formatShortDate(request.requestedAt)}`];
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
      break;
    case 'rejected':
      if (request.respondedAt) {
        lines.push(`Recusada em ${formatShortDate(request.respondedAt)}`);
      }
      break;
    case 'unanswered':
      lines.push('Prazo encerrado sem resposta');
      break;
  }
  return lines;
}
