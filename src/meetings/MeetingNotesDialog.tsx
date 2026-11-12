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
import { useId, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import {
  ApiError,
  isStateChangedError,
  messageForStatus,
} from '../services/apiError';
import { NOTES_MAX, writeMeetingNotes } from '../services/meetingService';
import type { MeetingItem } from '../services/meetingService';

export const NOTES_TOO_LONG_MESSAGE = `Os apontamentos devem ter no máximo ${NOTES_MAX} caracteres.`;

interface MeetingNotesDialogProps {
  open: boolean;
  meeting: MeetingItem;
  /** `removed` é verdadeiro quando o texto ficou vazio e os apontamentos foram apagados. */
  onSaved: (removed: boolean) => void;
  /** 404 ou 409: a reunião mudou ou a orientação encerrou; quem usa avisa e atualiza a lista. */
  onStateChanged: (message: string) => void;
  onClose: () => void;
  onExited: () => void;
}

/**
 * O diálogo dos apontamentos de uma reunião realizada (RF58, RN44): texto livre de até 3000
 * caracteres sem contar as pontas, com contador e bloqueio acima do limite. Salvar um texto vazio
 * remove os apontamentos, e isso pede confirmação explícita (RNF21). Há aviso de alterações não
 * salvas (RNF28). Quem usa troca a `key` a cada abertura.
 */
export function MeetingNotesDialog({
  open,
  meeting,
  onSaved,
  onStateChanged,
  onClose,
  onExited,
}: MeetingNotesDialogProps) {
  const id = useId();
  const counterId = `${id}-counter`;
  const original = meeting.notes.trim();
  const [text, setText] = useState(original);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const trimmed = text.trim();
  const tooLong = trimmed.length > NOTES_MAX;
  const pending = trimmed !== original;
  const removing = trimmed === '' && original !== '';
  const { requestClose, dialogs } = useDiscardGuard({
    pending,
    open,
    busy: submitting,
    onClose,
  });

  const send = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFailure(null);
    try {
      await writeMeetingNotes(meeting.id, trimmed);
      // O diálogo está fechando: o envio continua marcado como em curso até ele sair, para um
      // clique durante a animação de saída não enviar de novo.
      onSaved(removing);
    } catch (error) {
      setSubmitting(false);
      setConfirmingRemoval(false);
      if (isStateChangedError(error)) {
        onStateChanged(error.message);
        return;
      }
      setFailure(
        error instanceof ApiError ? error.message : messageForStatus(0),
      );
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
        <Box
          component="form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending || tooLong || submitting) return;
            if (removing) setConfirmingRemoval(true);
            else void send();
          }}
        >
          <DialogTitle id={`${id}-title`}>Apontamentos da reunião</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <DialogContentText>
                Registre o que foi tratado na reunião. O aluno orientando lê os
                apontamentos, e eles ficam congelados quando a orientação for
                encerrada.
              </DialogContentText>
              <PendingChangesNotice visible={pending} actionLabel="Salvar" />
              <TextField
                id={`${id}-field`}
                label="Apontamentos"
                multiline
                minRows={6}
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={submitting}
                error={tooLong}
                helperText={tooLong ? NOTES_TOO_LONG_MESSAGE : undefined}
                slotProps={{
                  htmlInput: {
                    // O contador é lido junto do campo, e não só quando o limite já foi passado.
                    'aria-describedby': tooLong
                      ? `${counterId} ${id}-field-helper-text`
                      : counterId,
                  },
                }}
              />
              <Typography
                id={counterId}
                variant="caption"
                color={tooLong ? 'error' : 'text.secondary'}
                sx={{ alignSelf: 'flex-end' }}
              >
                {trimmed.length}/{NOTES_MAX}
              </Typography>
              {failure && <Alert severity="error">{failure}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={requestClose} disabled={submitting}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!pending || tooLong || submitting}
            >
              {submitting ? 'Salvando…' : removing ? 'Remover' : 'Salvar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <ConfirmDialog
        open={confirmingRemoval}
        title="Remover os apontamentos?"
        message="O texto ficará vazio e os apontamentos serão apagados. Esta ação não pode ser desfeita."
        confirmLabel="Remover apontamentos"
        cancelLabel="Voltar"
        busy={submitting}
        busyLabel="Removendo…"
        onConfirm={() => void send()}
        onCancel={() => setConfirmingRemoval(false)}
      />
      {dialogs}
    </>
  );
}
