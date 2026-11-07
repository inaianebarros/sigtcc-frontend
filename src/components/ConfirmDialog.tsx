import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useId } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Enquanto uma ação está em andamento, o diálogo não aceita outro clique nem fecha. */
  busy?: boolean;
  busyLabel?: string;
  confirmColor?: 'primary' | 'error';
  /** Chamado quando a animação de saída termina: o momento seguro de mover o foco. */
  onExited?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  busy = false,
  busyLabel = 'Enviando…',
  confirmColor = 'error',
  onExited,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      slotProps={{ transition: { onExited } }}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={confirmColor}
          disabled={busy}
        >
          {busy ? busyLabel : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
