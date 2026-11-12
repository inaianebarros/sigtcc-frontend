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
import { ApiError, isStateChangedError } from '../services/apiError';
import { createMeeting, updateMeeting } from '../services/meetingService';
import type { MeetingInput, MeetingItem } from '../services/meetingService';
import { AdviseeSearchField } from './AdviseeSearchField';
import {
  DESCRIPTION_MAX,
  ENDED_MESSAGE,
  meetingFormSchema,
  santaremParts,
} from './meetingForm';
import type { MeetingFormValues } from './meetingForm';

const FIELD_BY_API_FIELD = {
  date: 'date',
  time: 'time',
  end_time: 'endTime',
  description: 'description',
  student_id: 'student',
} as const;

interface MeetingRequestDialogProps {
  open: boolean;
  /** O professor escolhe o aluno (RF18); o aluno solicita ao seu orientador (RF17). */
  isTeacher: boolean;
  /** O aluno que já vem escolhido, como o do filtro da lista (só o professor). */
  preselectedStudent: { id: number; name: string } | null;
  /** A reunião que se edita (RF21); sem ela, o diálogo solicita uma nova. */
  meeting?: MeetingItem;
  onSaved: () => void;
  /** Editar sem mudar nada: quem usa avisa e fecha, sem chamar o servidor. */
  onNoChanges: () => void;
  /** Na edição, 404 ou 409 (a reunião mudou ou a orientação encerrou): avisa e atualiza a lista. */
  onStateChanged: (message: string) => void;
  /** A orientação terminou com o diálogo aberto: quem usa atualiza a sessão e a lista. */
  onEnded: () => void;
  onClose: () => void;
  onExited: () => void;
}

/**
 * O diálogo de solicitar (RF17 e RF18) e de editar (RF21) uma reunião: data e hora nativas, lidas
 * em Santarém, e a descrição. Um só botão grava tudo, os erros do servidor vão aos campos e há
 * aviso de alterações não salvas (RNF28). Na edição, só o que mudou é enviado, e numa reunião
 * aceita mudar a data ou a hora avisa que ela volta a pendente (RN39). Quem usa troca a `key` a
 * cada abertura.
 */
export function MeetingRequestDialog({
  open,
  isTeacher,
  preselectedStudent,
  meeting,
  onSaved,
  onNoChanges,
  onStateChanged,
  onEnded,
  onClose,
  onExited,
}: MeetingRequestDialogProps) {
  const id = useId();
  const editing = meeting !== undefined;
  const original = useMemo(
    () =>
      meeting
        ? {
            ...santaremParts(meeting.scheduledAt),
            endTime: santaremParts(meeting.endsAt).time,
          }
        : undefined,
    [meeting],
  );
  const schema = useMemo(
    () => meetingFormSchema(isTeacher && !editing, undefined, original),
    [isTeacher, editing, original],
  );
  const initial: MeetingFormValues = {
    student: isTeacher && !editing ? preselectedStudent : null,
    date: original?.date ?? '',
    time: original?.time ?? '',
    endTime: original?.endTime ?? '',
    description: meeting?.description ?? '',
  };
  // O formulário entrega a descrição aparada; a original pode trazer espaços nas pontas.
  const initialDescription = initial.description.trim();
  const {
    control,
    register,
    handleSubmit,
    getValues,
    trigger,
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
  const endTime = useWatch({ control, name: 'endTime' });
  const description = useWatch({ control, name: 'description' });
  const [ended, setEnded] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const current: MeetingFormValues = {
    student,
    date,
    time,
    endTime,
    description,
  };
  const valid = schema.safeParse(current).success;
  // Há alteração pendente quando o formulário recebeu conteúdo ainda não enviado (RNF28); o
  // aluno que já veio escolhido do filtro não conta.
  const pending =
    current.date !== initial.date ||
    current.time !== initial.time ||
    current.endTime !== initial.endTime ||
    current.description.trim() !== initialDescription ||
    current.student?.id !== initial.student?.id;
  // RN39: uma reunião aceita volta a pendente se a data, o início ou o término mudarem.
  const returnsToPending =
    meeting?.situation === 'accepted' &&
    (current.date !== initial.date ||
      current.time !== initial.time ||
      current.endTime !== initial.endTime);
  const { requestClose, dialogs } = useDiscardGuard({
    pending: pending && !ended,
    open,
    busy: isSubmitting,
    onClose,
  });

  const submit = handleSubmit(async (form) => {
    setFailure(null);
    try {
      if (meeting) {
        const changes: Partial<MeetingInput> = {};
        if (form.date !== initial.date) changes.date = form.date;
        if (form.time !== initial.time) changes.time = form.time;
        if (form.endTime !== initial.endTime) changes.endTime = form.endTime;
        if (form.description !== initialDescription)
          changes.description = form.description;
        if (Object.keys(changes).length === 0) {
          onNoChanges();
          return;
        }
        await updateMeeting(meeting.id, changes);
        onSaved();
        return;
      }
      await createMeeting(
        {
          date: form.date,
          time: form.time,
          endTime: form.endTime,
          // Já vem aparada: o resolver entrega o valor depois do `trim` do esquema.
          description: form.description,
        },
        isTeacher ? form.student?.id : undefined,
      );
      onSaved();
    } catch (error) {
      if (meeting && isStateChangedError(error)) {
        onStateChanged(error.message);
        return;
      }
      // 409 para o aluno e 404 para o professor: a orientação já não está ativa. Qualquer outro
      // 404 ou 409 não é esse caso, e não pode bloquear o envio com a mensagem errada.
      if (
        error instanceof ApiError &&
        error.status === (isTeacher ? 404 : 409)
      ) {
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
          <DialogTitle id={`${id}-title`}>
            {editing ? 'Editar reunião' : 'Solicitar reunião'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <PendingChangesNotice
                visible={pending && !ended}
                actionLabel={editing ? 'Salvar' : 'Solicitar'}
              />
              {/* A região fica sempre montada, para o leitor de tela anunciar o aviso quando entra. */}
              <Box role="status" aria-live="polite">
                {returnsToPending && (
                  <Alert severity="warning" role="presentation">
                    Esta reunião já foi aceita. Se você mudar a data, o início
                    ou o término, ela voltará a ficar pendente e a outra parte
                    precisará aceitar de novo.
                  </Alert>
                )}
              </Box>
              {ended && <Alert severity="warning">{ENDED_MESSAGE}</Alert>}
              {isTeacher && !editing && (
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
                  // O erro de horário passado fica no campo da hora: mudar a data o revalida.
                  {...register('date', { deps: ['time'] })}
                />
                <TextField
                  label="Hora de início"
                  type="time"
                  required
                  disabled={locked}
                  error={Boolean(errors.time)}
                  helperText={errors.time?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1 }}
                  // O término é comparado com o início: mudar o início o revalida, mas só depois
                  // de o término ter sido preenchido, para não cobrá-lo antes da hora.
                  {...register('time', {
                    onChange: () => {
                      if (getValues('endTime')) void trigger('endTime');
                    },
                  })}
                />
                <TextField
                  label="Hora de término"
                  type="time"
                  required
                  disabled={locked}
                  error={Boolean(errors.endTime)}
                  helperText={errors.endTime?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1 }}
                  {...register('endTime')}
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
                  {isSubmitting
                    ? editing
                      ? 'Salvando…'
                      : 'Solicitando…'
                    : editing
                      ? 'Salvar'
                      : 'Solicitar'}
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
