import { Alert, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { formatDateTime } from '../formatters/dateTime';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { hasActiveAdvisingOf } from '../navigation/advisingState';
import { isStateChangedError } from '../services/apiError';
import { getMyTopic, saveMyTopic } from '../services/thesisService';
import type { ThesisTopic } from '../services/thesisService';
import { ThesisTopicField } from '../thesis/ThesisTopicField';
import { ADVISING_ENDED_TOPIC_MESSAGE } from '../thesis/thesisForm';
import { useThesisTopicForm } from '../thesis/useThesisTopicForm';

const NO_ADVISING_MESSAGE =
  'O tema do TCC só pode ser cadastrado com uma orientação ativa.';

function TopicEditor({ initial }: { initial: ThesisTopic }) {
  const { user, refreshUser } = useSession();
  const { notify } = useFeedback();
  const [saved, setSaved] = useState(initial);
  const [ended, setEnded] = useState(false);
  const { form, trimmed, pending, canSave } = useThesisTopicForm(
    saved.description ?? '',
  );
  const noAdvising = user !== null && !hasActiveAdvisingOf(user);
  const readOnly = ended || noAdvising;
  const blocker = useUnsavedChangesGuard(pending && !readOnly);

  const submit = form.handleSubmit(async () => {
    try {
      const result = await saveMyTopic(trimmed);
      setSaved(result);
      form.reset({ description: result.description ?? '' });
      notify('Tema salvo.', 'success');
    } catch (error) {
      if (isStateChangedError(error)) {
        // A orientação terminou com a tela aberta: o texto fica, sem edição, e o menu atualiza.
        setEnded(true);
        void refreshUser();
        return;
      }
      const message = applyApiFieldErrors(
        error,
        { description: 'description' },
        form.setError,
      );
      if (message) notify(message, 'error');
    }
  });

  return (
    <Stack spacing={3} component="form" onSubmit={submit} noValidate>
      {saved.description ? (
        <Stack spacing={0.5}>
          <Typography variant="h6" component="h2">
            Tema atual
          </Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>
            {saved.description}
          </Typography>
          {saved.updatedAt && (
            <Typography variant="body2" color="text.secondary">
              Última alteração em {formatDateTime(saved.updatedAt)}
            </Typography>
          )}
        </Stack>
      ) : (
        !readOnly && (
          <Alert severity="info">Você ainda não cadastrou o tema do TCC.</Alert>
        )
      )}
      {readOnly ? (
        <Alert severity="warning">
          {ended ? ADVISING_ENDED_TOPIC_MESSAGE : NO_ADVISING_MESSAGE}
        </Alert>
      ) : (
        <>
          <ThesisTopicField
            form={form}
            length={trimmed.length}
            pending={pending}
            disabled={form.formState.isSubmitting}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!canSave || form.formState.isSubmitting}
            sx={{ alignSelf: 'flex-start' }}
          >
            {form.formState.isSubmitting ? 'Salvando…' : 'Salvar tema'}
          </Button>
        </>
      )}
      <UnsavedChangesDialog blocker={blocker} />
    </Stack>
  );
}

/** O tema do TCC da orientação ativa, para o aluno (RF23 e RF24, RN12): um formulário só. */
export function StudentThesisPage() {
  const [reload, setReload] = useState(0);
  const topic = useLoad(getMyTopic, reload);
  return (
    <Stack spacing={3} sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h4" component="h1">
        Tema do TCC
      </Typography>
      {topic.status === 'loading' && (
        <Stack spacing={2} data-testid="thesis-skeleton" aria-hidden>
          <Skeleton variant="rounded" height={80} />
          <Skeleton variant="rounded" height={140} />
        </Stack>
      )}
      {topic.status === 'error' && (
        <Stack spacing={2}>
          <Alert severity="error">{topic.message}</Alert>
          <Button
            onClick={() => setReload((current) => current + 1)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Tentar novamente
          </Button>
        </Stack>
      )}
      {topic.status === 'ready' && <TopicEditor initial={topic.data} />}
    </Stack>
  );
}
