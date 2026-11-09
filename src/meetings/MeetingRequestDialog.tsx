import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useId, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { isStateChangedError } from '../services/apiError';
import { createMeeting } from '../services/meetingService';
import { AdviseeSearchField } from './AdviseeSearchField';
import {
  DESCRIPTION_MAX,
  ENDED_MESSAGE,
  meetingFormSchema,
} from './meetingForm';
import type { MeetingFormValues } from './meetingForm';

const FIELD_BY_API_FIELD = {
  date: 'date',
  time: 'time',
  description: 'description',
  student_id: 'student',
} as const;

interface MeetingRequestDialogProps {
  open: boolean;
  /** O professor escolhe o aluno (RF18); o aluno solicita ao seu orientador (RF17). */
  isTeacher: boolean;
  /** O aluno que já vem escolhido, como o do filtro da lista (só o professor). */
  preselectedStudent: { id: number; name: string } | null;
  onSaved: () => void;
  /** A orientação terminou com o diálogo aberto: quem usa atualiza a sessão e a lista. */
  onEnded: () => void;
  onClose: () => void;
  onExited: () => void;
}

/**
 * O diálogo de solicitar reunião (RF17 e RF18): data e hora nativas, lidas em Santarém, e a
 * descrição. Um só botão grava tudo, os erros do servidor vão aos campos e há aviso de alterações
 * não salvas (RNF28). Quem usa troca a `key` a cada abertura.
 */
export function MeetingRequestDialog({
  open,
  isTeacher,
  preselectedStudent,
  onSaved,
  onEnded,
  onClose,
  onExited,
}: MeetingRequestDialogProps) {
  const id = useId();
  const schema = useMemo(() => meetingFormSchema(isTeacher), [isTeacher]);
  const initial: MeetingFormValues = {
    student: isTeacher ? preselectedStudent : null,
    date: '',
    time: '',
    description: '',
  };
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MeetingFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: initial,
  });
  const student = useWatch({ control, name: 'student' });
  const date = useWatch({ control, name: 'date' });
  const time = useWatch({ control, name: 'time' });
  const description = useWatch({ control, name: 'description' });
  const [ended, setEnded] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const current: MeetingFormValues = { student, date, time, description };
  const valid = schema.safeParse(current).success;
  // Há alteração pendente quando o formulário recebeu conteúdo ainda não enviado (RNF28); o
  // aluno que já veio escolhido do filtro não conta.
  const pending =
    current.date !== '' ||
    current.time !== '' ||
    current.description.trim() !== '' ||
    current.student?.id !== initial.student?.id;
  const { requestClose, dialogs } = useDiscardGuard({
    pending: pending && !ended,
    open,
    busy: isSubmitting,
    onClose,
  });

  const submit = handleSubmit(async (form) => {
    setFailure(null);
    try {
      await createMeeting(
        {
          date: form.date,
          time: form.time,
          // Já vem aparada: o resolver entrega o valor depois do `trim` do esquema.
          description: form.description,
        },
        isTeacher ? form.student?.id : undefined,
      );
      onSaved();
    } catch (error) {
      if (isStateChangedError(error)) {
        // 409 para o aluno e 404 para o professor: a orientação já não está ativa.
        setEnded(true);
        onEnded();
        return;
      }
      setFailure(applyApiFieldErrors(error, FIELD_BY_API_FIELD, setError));
    }
  });

  const locked = isSubmitting || ended;
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
          <DialogTitle id={`${id}-title`}>Solicitar reunião</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <PendingChangesNotice visible={pending && !ended} />
              {ended && <Alert severity="warning">{ENDED_MESSAGE}</Alert>}
              {isTeacher && (
                <Controller
                  name="student"
                  control={control}
                  render={({ field }) => (
                    <AdviseeSearchField
                      label="Aluno"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.student?.message}
                      disabled={locked}
                    />
                  )}
                />
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Data"
                  type="date"
                  required
                  disabled={locked}
                  error={Boolean(errors.date)}
                  helperText={errors.date?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1 }}
                  {...register('date')}
                />
                <TextField
                  label="Hora"
                  type="time"
                  required
                  disabled={locked}
                  error={Boolean(errors.time)}
                  helperText={errors.time?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1 }}
                  {...register('time')}
                />
              </Stack>
              <TextField
                label="Descrição"
                required
                multiline
                minRows={3}
                disabled={locked}
                error={Boolean(errors.description)}
                helperText={errors.description?.message}
                {...register('description')}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ alignSelf: 'flex-end' }}
              >
                {current.description.trim().length}/{DESCRIPTION_MAX}
              </Typography>
              {failure && <Alert severity="error">{failure}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            {ended ? (
              <Button onClick={onClose}>Fechar</Button>
            ) : (
              <>
                <Button onClick={requestClose} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!valid || isSubmitting}
                >
                  {isSubmitting ? 'Solicitando…' : 'Solicitar'}
                </Button>
              </>
            )}
          </DialogActions>
        </Box>
      </Dialog>
      {dialogs}
    </>
  );
}
