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
import { ConfirmDialog } from '../components/ConfirmDialog';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { useLoad } from '../hooks/useLoad';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { isStateChangedError } from '../services/apiError';
import { getAdviseeTopic, saveAdviseeTopic } from '../services/thesisService';
import { ThesisTopicField } from './ThesisTopicField';
import { useThesisTopicForm } from './useThesisTopicForm';

interface ThesisTopicDialogProps {
  advisee: { id: number; name: string };
  open: boolean;
  onSaved: () => void;
  /** A orientação terminou com o diálogo aberto: o servidor responde 404 ao professor. */
  onStateChanged: (error: { status: number; message: string }) => void;
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
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const blocker = useUnsavedChangesGuard(pending && open);

  const requestClose = () => {
    if (form.formState.isSubmitting) return;
    if (pending) setConfirmingDiscard(true);
    else onClose();
  };

  const submit = form.handleSubmit(async () => {
    try {
      await saveAdviseeTopic(advisee.id, trimmed);
      onSaved();
    } catch (error) {
      if (isStateChangedError(error)) {
        onStateChanged(error);
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
              {found && (
                <ThesisTopicField
                  form={form}
                  length={trimmed.length}
                  pending={pending}
                  disabled={form.formState.isSubmitting}
                />
              )}
              {rootError && <Alert severity="error">{rootError}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            {topic.status === 'ready' && topic.data === null ? (
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
      <ConfirmDialog
        open={confirmingDiscard}
        title="Descartar alterações?"
        message="Você tem alterações que ainda não foram salvas. Se fechar agora, elas serão perdidas."
        confirmLabel="Sair sem salvar"
        cancelLabel="Continuar editando"
        onCancel={() => setConfirmingDiscard(false)}
        onConfirm={() => {
          setConfirmingDiscard(false);
          onClose();
        }}
      />
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
