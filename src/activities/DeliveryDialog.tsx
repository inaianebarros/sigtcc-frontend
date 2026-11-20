import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
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
  /** Um aviso no topo, como o de que a atividade mudou na releitura do detalhe. */
  notice?: ReactNode;
  /** A atividade mudou e a entrega já não cabe: o botão fica desabilitado, e o aviso diz por quê. */
  actionBlocked?: boolean;
  onSaved: () => void;
  /** 404 ou 409: a situação mudou desde que a tela a leu; quem usa avisa e recarrega. */
  onStateChanged: (error: ApiError) => void;
  onClose: () => void;
  onExited: () => void;
}

/**
 * O diálogo de entrega (RF31): escolhe de 1 a 5 arquivos pelo campo nativo ou soltando-os, confere
 * cada um como o servidor o fará, envia com o progresso e leva os erros de cada arquivo ao lado
 * dele. Há aviso de arquivos escolhidos e não enviados (RNF28). Quem usa troca a `key` a cada
 * abertura.
 */
export function DeliveryDialog({
  open,
  send,
  notice,
  actionBlocked = false,
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
    if (actionBlocked) return;
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
      const rest = Object.values(chosenFiles.applyServerErrors(error));
      setFailure(
        Object.keys(error.fieldErrors).length === 0
          ? error.message
          : (rest[0] ?? null),
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
            {notice}
            <DialogContentText>
              Os arquivos ficam na linha do tempo. O orientador só os revisa
              depois que você enviar a atividade para revisão.
            </DialogContentText>
            {/* Com a ação bloqueada, mandar clicar no botão desabilitado contradiria o aviso. */}
            <PendingChangesNotice
              visible={pending && !actionBlocked}
              actionLabel="Entregar arquivos"
            />
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
            disabled={!pending || hasProblem || sending || actionBlocked}
            onClick={() => void submit()}
          >
            {sending ? 'Enviando…' : 'Entregar arquivos'}
          </Button>
        </DialogActions>
      </Dialog>
      {dialogs}
    </>
  );
}
