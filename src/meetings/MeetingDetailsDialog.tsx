import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { MeetingItem } from '../services/meetingService';
import { MeetingDetails } from './MeetingDetails';

interface MeetingDetailsDialogProps {
  open: boolean;
  item: MeetingItem;
  /** O id do usuário logado: quem solicitou é "Você" ou o nome da outra parte. */
  userId: number;
  /** As ações permitidas (responder, editar e cancelar), que o servidor decide. */
  actions: ReactNode;
  /** Um aviso no topo, como o de que a reunião mudou na releitura do calendário. */
  notice?: ReactNode;
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
  notice,
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
          {notice}
          <MeetingDetails item={item} userId={userId} />
          {actions}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
