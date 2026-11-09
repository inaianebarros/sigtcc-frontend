import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { formatFileSize } from '../formatters/fileSize';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { ApiError, isStateChangedError, messageOf } from '../services/apiError';
import {
  ACCEPTED_EXTENSIONS,
  COUNT_MESSAGE,
  MAX_FILE_MEGABYTES,
  MAX_FILES,
  contentTypeOf,
  problemWith,
} from './fileValidation';

interface ChosenFile {
  /** Identifica o arquivo na lista, mesmo com dois de mesmo nome. */
  key: number;
  file: File;
}

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
  const nextKey = useRef(0);
  const [chosen, setChosen] = useState<ChosenFile[]>([]);
  const [overflowed, setOverflowed] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [serverErrors, setServerErrors] = useState<Record<number, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const problems = chosen.map(({ file }) => problemWith(file));
  const hasProblem = problems.some((problem) => problem !== null);
  const pending = chosen.length > 0;
  const { requestClose, dialogs } = useDiscardGuard({
    pending,
    open,
    busy: sending,
    onClose,
  });

  const add = (incoming: File[]) => {
    if (sending || incoming.length === 0) return;
    const room = Math.max(MAX_FILES - chosen.length, 0);
    const accepted = incoming.slice(0, room);
    setOverflowed(accepted.length < incoming.length);
    setServerErrors({});
    setFailure(null);
    setChosen([
      ...chosen,
      ...accepted.map((file) => ({ key: nextKey.current++, file })),
    ]);
  };

  const remove = (key: number) => {
    setOverflowed(false);
    setChosen(chosen.filter((item) => item.key !== key));
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    add(Array.from(event.target.files ?? []));
    // Para escolher o mesmo arquivo de novo depois de removê-lo.
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    add(Array.from(event.dataTransfer.files));
  };

  const submit = async () => {
    setSending(true);
    setProgress(0);
    setFailure(null);
    setServerErrors({});
    try {
      await send(
        chosen.map((item) => item.file),
        setProgress,
      );
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
            <Box
              role="group"
              aria-label="Área para soltar arquivos"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              sx={{
                border: 2,
                borderStyle: 'dashed',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                textAlign: 'center',
              }}
            >
              <Stack spacing={1} sx={{ alignItems: 'center' }}>
                <Typography color="text.secondary">
                  Arraste os arquivos até aqui ou escolha no computador. De 1 a{' '}
                  {MAX_FILES} arquivos de até {MAX_FILE_MEGABYTES} MB: PDF, DOC,
                  DOCX, ZIP, PNG ou JPG.
                </Typography>
                <Button component="label" variant="outlined" disabled={sending}>
                  Escolher arquivos
                  <input
                    hidden
                    type="file"
                    multiple
                    accept={ACCEPTED_EXTENSIONS}
                    disabled={sending}
                    onChange={onPick}
                  />
                </Button>
              </Stack>
            </Box>
            {overflowed && <Alert severity="warning">{COUNT_MESSAGE}</Alert>}
            {chosen.length === 0 ? (
              <Typography color="text.secondary">
                Nenhum arquivo escolhido.
              </Typography>
            ) : (
              <Box
                component="ul"
                aria-label="Arquivos escolhidos"
                sx={{ m: 0, p: 0, listStyle: 'none' }}
              >
                {chosen.map(({ key, file }, index) => {
                  const message = problems[index] ?? serverErrors[key];
                  return (
                    <Stack
                      component="li"
                      key={key}
                      direction="row"
                      sx={{ alignItems: 'flex-start', gap: 1, py: 0.5 }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ overflowWrap: 'anywhere' }}>
                          {file.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {`${formatFileSize(file.size)}, ${contentTypeOf(file.name) ?? 'tipo não reconhecido'}`}
                        </Typography>
                        {message && (
                          <Typography variant="body2" color="error">
                            {message}
                          </Typography>
                        )}
                      </Box>
                      <IconButton
                        aria-label={`Remover ${file.name}`}
                        disabled={sending}
                        onClick={() => remove(key)}
                      >
                        <DeleteOutlinedIcon />
                      </IconButton>
                    </Stack>
                  );
                })}
              </Box>
            )}
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
