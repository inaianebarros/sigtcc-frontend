import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useId, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { isStateChangedError } from '../services/apiError';
import { DESCRIPTION_MAX, reasonFormSchema } from './meetingForm';
import type { ReasonNoun } from './meetingForm';

interface MeetingReasonDialogProps {
  open: boolean;
  title: string;
  /** O que a ação faz e, se for o caso, que não tem volta (RNF21). */
  intro: string;
  noun: ReasonNoun;
  /** O botão que confirma, com o nome da ação; o outro se chama "Voltar". */
  confirmLabel: string;
  sendingLabel: string;
  send: (reason: string) => Promise<void>;
  onSaved: () => void;
  /** 404 ou 409: a reunião mudou, expirou ou a orientação encerrou; quem usa avisa e atualiza a lista. */
  onStateChanged: (message: string) => void;
  onClose: () => void;
  onExited: () => void;
}

/**
 * O diálogo de um motivo obrigatório: a justificativa da recusa (RN11) e o motivo do cancelamento
 * (RN10), de 1 a 500 caracteres com contador. Há aviso de alterações não salvas (RNF28). Quem usa
 * troca a `key` a cada abertura.
 */
export function MeetingReasonDialog({
  open,
  title,
  intro,
  noun,
  confirmLabel,
  sendingLabel,
  send,
  onSaved,
  onStateChanged,
  onClose,
  onExited,
}: MeetingReasonDialogProps) {
  const id = useId();
  const schema = useMemo(() => reasonFormSchema(noun), [noun]);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ reason: string }>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { reason: '' },
  });
  const reason = useWatch({ control, name: 'reason' });
  const [failure, setFailure] = useState<string | null>(null);

  const valid = schema.safeParse({ reason }).success;
  const pending = reason.trim() !== '';
  const { requestClose, dialogs } = useDiscardGuard({
    pending,
    open,
    busy: isSubmitting,
    onClose,
  });

  const submit = handleSubmit(async (form) => {
    setFailure(null);
    try {
      // Já vem aparada: o resolver entrega o valor depois do `trim` do esquema.
      await send(form.reason);
      onSaved();
    } catch (error) {
      if (isStateChangedError(error)) {
        onStateChanged(error.message);
        return;
      }
      setFailure(applyApiFieldErrors(error, { reason: 'reason' }, setError));
    }
  });

  const label = noun === 'motivo' ? 'Motivo' : 'Justificativa';
  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        aria-labelledby={`${id}-title`}
        fullWidth
        maxWidth="sm"
        slotProps={{ transition: { onExited } }}
      >
        <Box component="form" onSubmit={submit} noValidate>
          <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <DialogContentText>{intro}</DialogContentText>
              <PendingChangesNotice
                visible={pending}
                actionLabel={confirmLabel}
              />
              <TextField
                label={label}
                required
                multiline
                minRows={3}
                disabled={isSubmitting}
                error={Boolean(errors.reason)}
                helperText={errors.reason?.message}
                {...register('reason')}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ alignSelf: 'flex-end' }}
              >
                {reason.trim().length}/{DESCRIPTION_MAX}
              </Typography>
              {failure && <Alert severity="error">{failure}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={requestClose} disabled={isSubmitting}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={!valid || isSubmitting}
            >
              {isSubmitting ? sendingLabel : confirmLabel}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      {dialogs}
    </>
  );
}
