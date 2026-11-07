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
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
    >
      <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-message`}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button onClick={onConfirm} variant="contained" color="error">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
