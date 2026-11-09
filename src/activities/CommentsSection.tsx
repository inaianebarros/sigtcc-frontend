import { Alert, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useStateChangedNotice } from '../hooks/useStateChangedNotice';
import { ApiError, messageOf } from '../services/apiError';
import { addComment } from '../services/commentService';
import { CommentCard } from './CommentCard';
import { CommentForm } from './CommentForm';
import { commentSchema } from './commentSchema';
import { Section } from './Section';
import { useComments } from './useComments';

interface CommentsSectionProps {
  activityId: number;
  /** O usuário que lê, para marcar os próprios comentários com "Você". */
  currentUserId: number | null;
  /** A atividade está concluída: a lista continua e o campo não aceita comentário (RN15). */
  completed: boolean;
  /** O texto digitado e ainda não enviado vive na tela, que o guarda quando o detalhe recarrega. */
  text: string;
  onTextChange: (text: string) => void;
}

function countText(count: number): string {
  if (count === 0) return 'Nenhum comentário';
  return `${count} ${count === 1 ? 'comentário' : 'comentários'}`;
}

/**
 * Os comentários da atividade (RF32): a lista abre na página mais recente, com "Carregar
 * comentários anteriores" e "Atualizar" (não há tempo real), e o formulário envia um comentário.
 * Só rola até o último depois de enviar e de atualizar, nunca ao abrir.
 */
export function CommentsSection({
  activityId,
  currentUserId,
  completed,
  text,
  onTextChange,
}: CommentsSectionProps) {
  const comments = useComments(activityId);
  const notifyStateChanged = useStateChangedNotice();
  const lastComment = useRef<HTMLLIElement>(null);
  const [scrollRequests, setScrollRequests] = useState(0);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [closedByServer, setClosedByServer] = useState(false);

  useEffect(() => {
    if (scrollRequests > 0) {
      lastComment.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [scrollRequests]);

  const scrollToLast = () => setScrollRequests((count) => count + 1);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await comments.refresh();
      scrollToLast();
    } catch (error) {
      setNotice(messageOf(error));
    } finally {
      setRefreshing(false);
    }
  };

  const send = async () => {
    setSending(true);
    setFieldError(null);
    setNotice(null);
    try {
      const created = await addComment(activityId, commentSchema.parse(text));
      onTextChange('');
      comments.append(created);
      scrollToLast();
      // O servidor é a verdade: relê a página mais recente, e uma falha aqui não desfaz o envio.
      comments.refresh().catch(() => undefined);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setClosedByServer(true);
        setNotice(error.message);
      } else if (error instanceof ApiError && error.status === 404) {
        // A orientação encerrou: o texto digitado continua à vista.
        notifyStateChanged(error);
      } else if (error instanceof ApiError && error.fieldErrors.text) {
        setFieldError(error.fieldErrors.text);
      } else {
        setFieldError(messageOf(error));
      }
    } finally {
      setSending(false);
    }
  };

  const state = comments.state;
  return (
    <Section title="Comentários">
      <Stack
        direction="row"
        useFlexGap
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
      >
        <Typography>
          {state.status === 'ready' ? countText(state.count) : null}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={state.status !== 'ready' || refreshing}
          onClick={() => void refresh()}
        >
          Atualizar
        </Button>
      </Stack>
      {state.status === 'loading' && (
        <Stack spacing={1} data-testid="comments-skeleton" aria-hidden>
          <Skeleton variant="rounded" height={72} />
          <Skeleton variant="rounded" height={72} />
        </Stack>
      )}
      {state.status === 'error' && (
        <Stack spacing={1}>
          <Alert severity="error">{state.message}</Alert>
          <Button
            onClick={() => void comments.load()}
            sx={{ alignSelf: 'flex-start' }}
          >
            Tentar novamente
          </Button>
        </Stack>
      )}
      {state.status === 'ready' && (
        <>
          {state.start > 0 && (
            <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Button
                variant="outlined"
                disabled={comments.loadingOlder}
                onClick={() => void comments.loadOlder()}
              >
                {comments.loadingOlder
                  ? 'Carregando…'
                  : 'Carregar comentários anteriores'}
              </Button>
              {comments.olderFailed && (
                <Alert severity="error">
                  Não foi possível carregar os comentários anteriores. Tente
                  novamente.
                </Alert>
              )}
            </Stack>
          )}
          {state.items.length === 0 ? (
            <Typography color="text.secondary">
              Nenhum comentário ainda. Escreva o primeiro abaixo.
            </Typography>
          ) : (
            <Stack
              component="ul"
              spacing={1}
              aria-label="Comentários da atividade"
              sx={{ m: 0, p: 0 }}
            >
              {state.items.map((comment, index) => (
                <CommentCard
                  key={comment.id}
                  ref={
                    index === state.items.length - 1 ? lastComment : undefined
                  }
                  comment={comment}
                  own={comment.author.id === currentUserId}
                />
              ))}
            </Stack>
          )}
        </>
      )}
      <CommentForm
        text={text}
        onTextChange={onTextChange}
        closed={completed || closedByServer}
        sending={sending}
        error={fieldError}
        notice={notice}
        onSubmit={() => void send()}
      />
    </Section>
  );
}
