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
import {
  ADVISING_ENDED_TOPIC_MESSAGE,
  NO_ADVISING_TOPIC_MESSAGE,
} from '../thesis/thesisMessages';
import { useThesisTopicForm } from '../thesis/useThesisTopicForm';

function TopicEditor({ initial }: { initial: ThesisTopic }) {
  const { user, refreshUser } = useSession();
  const { notify } = useFeedback();
  const [saved, setSaved] = useState(initial);
  const [ended, setEnded] = useState(false);
  const { form, trimmed, pending, canSave } = useThesisTopicForm(
    saved.description ?? '',
  );
  // Lido uma vez, ao abrir: se a orientação terminar depois, a sessão atualizada não esconde o
  // texto que o aluno estava vendo (`ended` é quem trata esse caso).
  const [noAdvising] = useState(
    () => user !== null && !hasActiveAdvisingOf(user),
  );
  const blocker = useUnsavedChangesGuard(pending && !ended && !noAdvising);

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
        !noAdvising && (
          <Alert severity="info">Você ainda não cadastrou o tema do TCC.</Alert>
        )
      )}
      {noAdvising && (
        <Alert severity="warning">{NO_ADVISING_TOPIC_MESSAGE}</Alert>
      )}
      {ended && (
        <Alert severity="warning">{ADVISING_ENDED_TOPIC_MESSAGE}</Alert>
      )}
      {!noAdvising && (
        <>
          <ThesisTopicField
            form={form}
            length={trimmed.length}
            pending={pending && !ended}
            disabled={form.formState.isSubmitting || ended}
          />
          {!ended && (
            <Button
              type="submit"
              variant="contained"
              disabled={!canSave || form.formState.isSubmitting}
              sx={{ alignSelf: 'flex-start' }}
            >
              {form.formState.isSubmitting ? 'Salvando…' : 'Salvar tema'}
            </Button>
          )}
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
