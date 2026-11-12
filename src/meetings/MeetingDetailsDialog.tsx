import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
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

interface MeetingDetailsDialogProps {
  open: boolean;
  item: MeetingItem;
  /** O id do usuário logado: quem solicitou é "Você" ou o nome da outra parte. */
  userId: number;
  /** As ações permitidas (responder, editar e cancelar), que o servidor decide. */
  actions: ReactNode;
  onClose: () => void;
  onExited: () => void;
}

/**
 * O modal de uma reunião do calendário (RF19): o intervalo, a outra parte, a descrição, a situação
 * com os motivos de recusa e de cancelamento, e as ações permitidas.
 */
export function MeetingDetailsDialog({
  open,
  item,
  userId,
  actions,
  onClose,
  onExited,
}: MeetingDetailsDialogProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={`${id}-title`}
      fullWidth
      maxWidth="sm"
      slotProps={{ transition: { onExited } }}
    >
      <DialogTitle id={`${id}-title`}>Reunião</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
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
          <Typography variant="body2" color="text.secondary">
            Solicitada por {requestedBy(item, userId)}
          </Typography>
          {actions}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
