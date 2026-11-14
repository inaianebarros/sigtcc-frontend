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
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { DESCRIPTION_MAX, reasonFormSchema } from '../meetings/meetingForm';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { ApiError, isStateChangedError } from '../services/apiError';
import { ChosenFilesField } from './ChosenFilesField';
import { useChosenFiles } from './useChosenFiles';
import {
  MAX_FILE_MEGABYTES,
  MAX_FILES,
  REFUSAL_COUNT_MESSAGE,
} from './fileValidation';

const schema = reasonFormSchema('justificativa');

interface RefuseReviewDialogProps {
  open: boolean;
  /**
   * Recusa a atividade com a justificativa já sem as pontas e os anexos escolhidos (podem ser
   * nenhum), informando o progresso de 0 a 100; falha com o `ApiError` do servidor.
   */
  send: (
    justification: string,
    files: File[],
    onProgress: (percent: number) => void,
  ) => Promise<void>;
  onSaved: () => void;
  /** 404 ou 409: a orientação encerrou ou a atividade deixou de estar em revisão. */
  onStateChanged: (error: ApiError) => void;
  onClose: () => void;
  onExited: () => void;
}

/**
 * O diálogo da recusa de uma revisão (RF46): a justificativa é obrigatória, de 1 a 500 caracteres
 * com contador (RN40), de 0 a 5 anexos são opcionais, e o próprio diálogo é a confirmação. Há aviso
 * de texto ou arquivos não enviados (RNF28). Quem usa troca a `key` a cada abertura.
 */
export function RefuseReviewDialog({
  open,
  send,
  onSaved,
  onStateChanged,
  onClose,
  onExited,
}: RefuseReviewDialogProps) {
  const id = useId();
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
  const [progress, setProgress] = useState(0);
  const chosenFiles = useChosenFiles({
    disabled: isSubmitting,
    onAdd: () => setFailure(null),
  });
  const { chosen, files, hasProblem, setServerErrors } = chosenFiles;

  const valid = schema.safeParse({ reason }).success && !hasProblem;
  const pending = reason.trim() !== '' || chosen.length > 0;
  const { requestClose, dialogs } = useDiscardGuard({
    pending,
    open,
    busy: isSubmitting,
    onClose,
  });

  const submit = handleSubmit(async (form) => {
    setFailure(null);
    setServerErrors({});
    setProgress(0);
    try {
      // Já vem aparada: o resolver entrega o valor depois do `trim` do esquema.
      await send(form.reason, files, setProgress);
      onSaved();
    } catch (error) {
      if (isStateChangedError(error)) {
        onStateChanged(error);
        return;
      }
      const handled =
        error instanceof ApiError
          ? new ApiError(
              error.status,
              error.message,
              chosenFiles.applyServerErrors(error),
            )
          : error;
      setFailure(
        applyApiFieldErrors(handled, { justification: 'reason' }, setError),
      );
    }
  });

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
          <DialogTitle id={`${id}-title`}>Recusar a atividade</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <DialogContentText>
                A atividade voltará para Pendente e o aluno recupera o controle.
                As entregas anteriores continuam. Explique o que precisa ser
                refeito: o aluno e você veem a justificativa no histórico de
                revisões.
              </DialogContentText>
              <PendingChangesNotice
                visible={pending}
                actionLabel="Recusar atividade"
              />
              <TextField
                label="Justificativa"
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
              <ChosenFilesField
                chosenFiles={chosenFiles}
                instructions={`Anexos opcionais: arraste os arquivos até aqui ou escolha no computador. De 0 a ${MAX_FILES} arquivos de até ${MAX_FILE_MEGABYTES} MB: PDF, DOC, DOCX, ZIP, PNG ou JPG.`}
                overflowMessage={REFUSAL_COUNT_MESSAGE}
              />
              {isSubmitting && chosen.length > 0 && (
                <Stack spacing={0.5}>
                  <Typography>{`Enviando… ${progress}%`}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    aria-label="Progresso do envio"
                  />
                </Stack>
              )}
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
              {isSubmitting ? 'Recusando…' : 'Recusar atividade'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      {dialogs}
    </>
  );
}
