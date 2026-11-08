import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
} from '@mui/material';
import { useId, useState } from 'react';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { useLoad } from '../hooks/useLoad';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { isStateChangedError } from '../services/apiError';
import { getAdviseeTopic, saveAdviseeTopic } from '../services/thesisService';
import { ThesisTopicField } from './ThesisTopicField';
import { ADVISING_ENDED_TOPIC_MESSAGE } from './thesisMessages';
import { useThesisTopicForm } from './useThesisTopicForm';

interface ThesisTopicDialogProps {
  advisee: { id: number; name: string };
  open: boolean;
  onSaved: () => void;
  /** A orientação terminou com o diálogo aberto: quem usa atualiza a sessão e a lista. */
  onStateChanged: () => void;
  onClose: () => void;
  onExited: () => void;
}

/**
 * O diálogo do professor para cadastrar ou alterar o tema de um orientando (RF23 e RF24): o
 * mesmo formulário da tela do aluno, com o tema lido do servidor ao abrir. Quem usa troca a
 * `key` a cada abertura.
 */
export function ThesisTopicDialog({
  advisee,
  open,
  onSaved,
  onStateChanged,
  onClose,
  onExited,
}: ThesisTopicDialogProps) {
  const id = useId();
  const [reload, setReload] = useState(0);
  const topic = useLoad(() => getAdviseeTopic(advisee.id), reload);
  const found = topic.status === 'ready' && topic.data !== null;
  const saved = found ? (topic.data?.description ?? '') : '';
  const { form, trimmed, pending, canSave } = useThesisTopicForm(saved, found);
  // A orientação terminou com o diálogo aberto: o texto fica à vista, sem edição (RN12).
  const [ended, setEnded] = useState(false);
  const { requestClose, dialogs } = useDiscardGuard({
    pending: pending && !ended,
    open,
    busy: form.formState.isSubmitting,
    onClose,
  });

  const submit = form.handleSubmit(async () => {
    try {
      await saveAdviseeTopic(advisee.id, trimmed);
      onSaved();
    } catch (error) {
      if (isStateChangedError(error)) {
        // 404 para o professor e 409 para o aluno dizem o mesmo: a orientação já não está ativa.
        setEnded(true);
        onStateChanged();
        return;
      }
      const message = applyApiFieldErrors(
        error,
        { description: 'description' },
        form.setError,
      );
      if (message) form.setError('root', { message });
    }
  });

  const rootError = form.formState.errors.root?.message;
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
            Tema do TCC de {advisee.name}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {topic.status === 'loading' && (
                <Skeleton
                  variant="rounded"
                  height={140}
                  data-testid="thesis-dialog-skeleton"
                />
              )}
              {topic.status === 'error' && (
                <Stack spacing={1}>
                  <Alert severity="error">{topic.message}</Alert>
                  <Button
                    onClick={() => setReload((current) => current + 1)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Tentar novamente
                  </Button>
                </Stack>
              )}
              {topic.status === 'ready' && topic.data === null && (
                <Alert severity="warning">Orientando não encontrado</Alert>
              )}
              {ended && (
                <Alert severity="warning">{ADVISING_ENDED_TOPIC_MESSAGE}</Alert>
              )}
              {found && (
                <ThesisTopicField
                  form={form}
                  length={trimmed.length}
                  pending={pending && !ended}
                  disabled={form.formState.isSubmitting || ended}
                />
              )}
              {rootError && <Alert severity="error">{rootError}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            {ended || (topic.status === 'ready' && topic.data === null) ? (
              <Button onClick={onClose}>Fechar</Button>
            ) : (
              <>
                <Button
                  onClick={requestClose}
                  disabled={form.formState.isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!found || !canSave || form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? 'Salvando…' : 'Salvar tema'}
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
