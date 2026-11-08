import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import { useId, useMemo, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { isStateChangedError } from '../services/apiError';
import { activityFormSchema, DESCRIPTION_MAX, TITLE_MAX } from './activityForm';
import type { ActivityFormValues } from './activityForm';
import { useAdviseeOptions } from './useAdviseeOptions';
import type { AdviseeOption } from './useAdviseeOptions';

const FIELD_BY_API_FIELD = {
  student_id: 'studentId',
  title: 'title',
  description: 'description',
  deadline: 'deadline',
} as const;

interface ActivityFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  /** Os valores com que o formulário abre: vazios na criação, os da atividade na edição. */
  initial: ActivityFormValues;
  /** O aluno que já vem escolhido, como o do cartão do orientando (só na criação). */
  preselectedStudent?: AdviseeOption | null;
  /** Grava. Uma falha de campo do servidor volta ao formulário; 404 e 409 vão a `onStateChanged`. */
  onSave: (values: ActivityFormValues) => Promise<void>;
  /** A situação mudou desde que a tela a leu (orientação encerrada, atividade concluída). */
  onStateChanged: (error: { status: number; message: string }) => void;
  onClose: () => void;
  onExited: () => void;
}

/** O Paper da lista de alunos, com o botão de carregar mais, que não fecha a lista. */
function StudentListPaper({
  hasMore,
  onLoadMore,
  ...paperProps
}: HTMLAttributes<HTMLElement> & { hasMore: boolean; onLoadMore: () => void }) {
  return (
    <Paper {...paperProps}>
      {paperProps.children}
      {hasMore && (
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            // O foco fica no campo: tirar o foco fecharia a lista antes do clique valer.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onLoadMore}
          >
            Carregar mais orientandos
          </Button>
        </Box>
      )}
    </Paper>
  );
}

/**
 * O diálogo de criar e de editar uma atividade (RF25 e RF26): um só botão grava tudo, os erros do
 * servidor aparecem nos campos e há aviso de alterações não salvas (RNF28). Quem usa troca a `key`
 * a cada abertura, para o formulário começar do valor inicial.
 */
export function ActivityFormDialog({
  mode,
  open,
  initial,
  preselectedStudent = null,
  onSave,
  onStateChanged,
  onClose,
  onExited,
}: ActivityFormDialogProps) {
  const id = useId();
  const schema = useMemo(
    () => activityFormSchema({ mode, initialDeadline: initial.deadline }),
    [mode, initial.deadline],
  );
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const blocker = useUnsavedChangesGuard(isDirty && open);
  const students = useAdviseeOptions(
    mode === 'create' ? preselectedStudent : null,
  );

  const requestClose = () => {
    if (isSubmitting) return;
    if (isDirty) setConfirmingDiscard(true);
    else onClose();
  };

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await onSave(values);
    } catch (error) {
      if (isStateChangedError(error)) {
        onStateChanged(error);
        return;
      }
      setFailure(applyApiFieldErrors(error, FIELD_BY_API_FIELD, setError));
    }
  });

  const isCreate = mode === 'create';
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
            {isCreate ? 'Nova atividade' : 'Editar atividade'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <PendingChangesNotice visible={isDirty} />
              {isCreate && (
                <Controller
                  name="studentId"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      options={students.options}
                      loading={students.loading}
                      loadingText="Carregando orientandos…"
                      noOptionsText="Nenhum orientando encontrado"
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                      }
                      value={
                        students.options.find(
                          (option) => String(option.id) === field.value,
                        ) ?? null
                      }
                      onChange={(_, option) =>
                        field.onChange(option ? String(option.id) : '')
                      }
                      onBlur={field.onBlur}
                      disabled={isSubmitting}
                      slots={{
                        paper: (paperProps) => (
                          <StudentListPaper
                            {...paperProps}
                            hasMore={students.hasMore}
                            onLoadMore={students.loadMore}
                          />
                        ),
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Aluno"
                          required
                          error={Boolean(errors.studentId)}
                          helperText={
                            errors.studentId?.message ??
                            (students.failed
                              ? 'Não foi possível carregar os orientandos.'
                              : undefined)
                          }
                        />
                      )}
                    />
                  )}
                />
              )}
              <TextField
                label="Título"
                required
                disabled={isSubmitting}
                error={Boolean(errors.title)}
                helperText={
                  errors.title?.message ?? `Até ${TITLE_MAX} caracteres`
                }
                {...register('title')}
              />
              <TextField
                label="Descrição"
                required
                multiline
                minRows={3}
                disabled={isSubmitting}
                error={Boolean(errors.description)}
                helperText={
                  errors.description?.message ??
                  `Até ${DESCRIPTION_MAX} caracteres`
                }
                {...register('description')}
              />
              <TextField
                label="Prazo"
                type="date"
                required
                disabled={isSubmitting}
                error={Boolean(errors.deadline)}
                helperText={errors.deadline?.message}
                slotProps={{ inputLabel: { shrink: true } }}
                {...register('deadline')}
              />
              {failure && <Alert severity="error">{failure}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={requestClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isCreate
                ? isSubmitting
                  ? 'Criando…'
                  : 'Criar'
                : isSubmitting
                  ? 'Salvando…'
                  : 'Salvar'}
            </Button>
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
