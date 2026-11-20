import { Stack, Typography } from '@mui/material';
import { formatDateTimeRange } from '../formatters/dateTime';
import type { MeetingItem } from '../services/meetingService';
import { SituationChip } from './SituationChip';

function requestedBy(item: MeetingItem, userId: number): string {
  return item.author.id === userId ? 'Você' : item.author.fullName;
}

/** Os motivos e a marca do cancelamento pelo sistema, sob a situação (RF19, RN34). */
function Reasons({ item }: { item: MeetingItem }) {
  return (
    <Stack spacing={0.5}>
      {item.situation === 'rejected' && item.rejectionReason && (
        <Typography variant="body2" color="text.secondary">
          Motivo da recusa: {item.rejectionReason}
        </Typography>
      )}
      {item.situation === 'cancelled' && (
        <>
          {item.cancelledBySystem && (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Cancelada pelo sistema
            </Typography>
          )}
          {item.cancellationReason && (
            <Typography variant="body2" color="text.secondary">
              Motivo do cancelamento: {item.cancellationReason}
            </Typography>
          )}
        </>
      )}
    </Stack>
  );
}

interface MeetingDetailsProps {
  item: MeetingItem;
  /** O id do usuário logado: quem solicitou é "Você" ou o nome da outra parte. */
  userId: number;
  /** O texto dos apontamentos vazios; sem ele, a seção some quando não há apontamentos. */
  emptyNotes?: string;
}

/**
 * O que se sabe de uma reunião (RF19): o intervalo, a outra parte, a descrição, a situação com os
 * motivos de recusa e de cancelamento, os apontamentos e quem a solicitou. É o conteúdo do modal
 * do calendário e da tela da reunião aberta pelo relatório (RF61), sem as ações.
 */
export function MeetingDetails({
  item,
  userId,
  emptyNotes,
}: MeetingDetailsProps) {
  return (
    <>
      <Typography>
        {formatDateTimeRange(item.scheduledAt, item.endsAt)}
      </Typography>
      <Typography color="text.secondary">
        Com: {item.counterpart.fullName}
      </Typography>
      <Typography sx={{ overflowWrap: 'anywhere' }}>
        {item.description}
      </Typography>
      <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
        <SituationChip situation={item.situation} />
        <Reasons item={item} />
      </Stack>
      {(item.notes || emptyNotes) && (
        // Os apontamentos da reunião realizada (RF19, RN44): as quebras de linha são
        // preservadas e o texto longo quebra em vez de estourar o modal.
        <Stack spacing={0.5} component="section" aria-label="Apontamentos">
          <Typography variant="subtitle2" component="h3">
            Apontamentos
          </Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {item.notes || emptyNotes}
          </Typography>
        </Stack>
      )}
      <Typography variant="body2" color="text.secondary">
        Solicitada por {requestedBy(item, userId)}
      </Typography>
    </>
  );
}
