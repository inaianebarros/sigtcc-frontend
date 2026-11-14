import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useId, useState } from 'react';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { ApiError, isStateChangedError, messageOf } from '../services/apiError';
import { ChosenFilesField } from './ChosenFilesField';
import { useChosenFiles } from './useChosenFiles';
import { COUNT_MESSAGE, MAX_FILE_MEGABYTES, MAX_FILES } from './fileValidation';

interface DeliveryDialogProps {
  open: boolean;
  /** Envia os arquivos, informando o progresso de 0 a 100; falha com o `ApiError` do servidor. */
  send: (files: File[], onProgress: (percent: number) => void) => Promise<void>;
  onSaved: () => void;
  /** 404 ou 409: a situação mudou desde que a tela a leu; quem usa avisa e recarrega. */
  onStateChanged: (error: ApiError) => void;
  onClose: () => void;
  onExited: () => void;
}

const FILE_ERROR_FIELD = /^files\.(\d+)$/;

/**
 * O diálogo de entrega (RF31): escolhe de 1 a 5 arquivos pelo campo nativo ou soltando-os, confere
 * cada um como o servidor o fará, envia com o progresso e leva os erros de cada arquivo ao lado
 * dele. Há aviso de arquivos escolhidos e não enviados (RNF28). Quem usa troca a `key` a cada
 * abertura.
 */
export function DeliveryDialog({
  open,
  send,
  onSaved,
  onStateChanged,
  onClose,
  onExited,
}: DeliveryDialogProps) {
  const id = useId();
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const chosenFiles = useChosenFiles({
    disabled: sending,
    onAdd: () => setFailure(null),
  });
  const { chosen, files, hasProblem, setServerErrors } = chosenFiles;

  const pending = chosen.length > 0;
  const { requestClose, dialogs } = useDiscardGuard({
    pending,
    open,
    busy: sending,
    onClose,
  });

  const submit = async () => {
    setSending(true);
    setProgress(0);
    setFailure(null);
    setServerErrors({});
    try {
      await send(files, setProgress);
      onSaved();
    } catch (error) {
      if (isStateChangedError(error)) {
        onStateChanged(error);
        return;
      }
      if (!(error instanceof ApiError)) {
        setFailure(messageOf(error));
        return;
      }
      const byFile: Record<number, string> = {};
      let general: string | null = null;
      for (const [field, message] of Object.entries(error.fieldErrors)) {
        const index = FILE_ERROR_FIELD.exec(field)?.[1];
        const target = index === undefined ? undefined : chosen[Number(index)];
        if (target) byFile[target.key] = message;
        else general ??= message;
      }
      setServerErrors(byFile);
      setFailure(
        Object.keys(error.fieldErrors).length === 0 ? error.message : general,
      );
    } finally {
      setSending(false);
    }
  };

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
        <DialogTitle id={`${id}-title`}>Entregar arquivos</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <PendingChangesNotice visible={pending} actionLabel="Entregar" />
            <ChosenFilesField
              chosenFiles={chosenFiles}
              instructions={`Arraste os arquivos até aqui ou escolha no computador. De 1 a ${MAX_FILES} arquivos de até ${MAX_FILE_MEGABYTES} MB: PDF, DOC, DOCX, ZIP, PNG ou JPG.`}
              overflowMessage={COUNT_MESSAGE}
            />
            {sending && (
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
          <Button onClick={requestClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={!pending || hasProblem || sending}
            onClick={() => void submit()}
          >
            {sending ? 'Enviando…' : 'Entregar'}
          </Button>
        </DialogActions>
      </Dialog>
      {dialogs}
    </>
  );
}
