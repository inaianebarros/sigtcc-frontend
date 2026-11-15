import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Alert, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { formatDateTime } from '../formatters/dateTime';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
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
import { ProfileSection } from './ProfileSection';

export const THESIS_SECTION_ID = 'tema';

function TopicEditor({
  initial,
  onPendingChange,
}: {
  initial: ThesisTopic;
  onPendingChange: (pending: boolean) => void;
}) {
  const { user, refreshUser } = useSession();
  const { notify } = useFeedback();
  const reasonId = useId();
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
  const locked = noAdvising || ended;
  const livePending = pending && !locked;

  // Quem usa o perfil junta esta pendência à do formulário no aviso de sair da tela (RNF28).
  useEffect(() => {
    onPendingChange(livePending);
    return () => onPendingChange(false);
  }, [livePending, onPendingChange]);

  const save = form.handleSubmit(async () => {
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

  const reason = ended
    ? ADVISING_ENDED_TOPIC_MESSAGE
    : noAdvising
      ? NO_ADVISING_TOPIC_MESSAGE
      : null;

  return (
    <Stack spacing={2}>
      {!locked && !saved.description && (
        <Alert severity="info">Você ainda não cadastrou o tema do TCC.</Alert>
      )}
      <ThesisTopicField
        form={form}
        length={trimmed.length}
        pending={livePending}
        disabled={form.formState.isSubmitting}
        readOnly={locked}
        describedBy={reason ? reasonId : undefined}
      />
      {reason && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <LockOutlinedIcon fontSize="small" color="action" aria-hidden />
          <Typography id={reasonId} variant="body2" color="text.secondary">
            {reason}
          </Typography>
        </Stack>
      )}
      {saved.updatedAt && saved.description && (
        <Typography variant="body2" color="text.secondary">
          Última alteração em {formatDateTime(saved.updatedAt)}
        </Typography>
      )}
      {!locked && (
        <Button
          // Fora do formulário do perfil: o tema grava na hora, por outro endereço do servidor.
          type="button"
          variant="outlined"
          onClick={() => void save()}
          disabled={!canSave || form.formState.isSubmitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {form.formState.isSubmitting ? 'Salvando…' : 'Salvar tema'}
        </Button>
      )}
    </Stack>
  );
}

/**
 * O tema do TCC dentro do perfil do aluno (RF04, RF23 e RF24, RN12): editável só com orientação
 * ativa; sem ela o campo fica bloqueado, com o motivo escrito. Grava por conta própria, fora do
 * "Salvar alterações" do perfil.
 */
export function ProfileThesisSection({
  onPendingChange,
}: {
  onPendingChange: (pending: boolean) => void;
}) {
  const [reload, setReload] = useState(0);
  const topic = useLoad(getMyTopic, reload);
  const { hash } = useLocation();
  const ready = topic.status === 'ready';

  // O link "cadastrar tema" do Dashboard abre o perfil em #tema: leva a seção à vista e o foco ao título.
  useEffect(() => {
    if (!ready || hash !== `#${THESIS_SECTION_ID}`) return;
    const title = document.getElementById(`${THESIS_SECTION_ID}-title`);
    title?.scrollIntoView({ block: 'start' });
    title?.focus({ preventScroll: true });
  }, [ready, hash]);

  return (
    <ProfileSection
      id={THESIS_SECTION_ID}
      title="Tema do TCC"
      description="Informe o tema do seu Trabalho de Conclusão de Curso."
    >
      {topic.status === 'loading' && (
        <Skeleton
          variant="rounded"
          height={120}
          data-testid="thesis-skeleton"
          aria-hidden
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
      {topic.status === 'ready' && (
        <TopicEditor initial={topic.data} onPendingChange={onPendingChange} />
      )}
    </ProfileSection>
  );
}
