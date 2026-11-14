import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef } from 'react';
import { NewComment } from './NewComment';
import { Section } from './Section';
import { TimelineEventCard } from './TimelineEventCard';
import { useActivityTimeline } from './useActivityTimeline';

interface ActivityTimelineProps {
  activityId: number;
  /** O usuário que lê, para marcar os próprios eventos com "Você". */
  currentUserId: number | null;
  /** A atividade está concluída: a linha do tempo continua e o campo não aceita comentário. */
  completed: boolean;
  /** O comentário ainda não enviado vive na tela, que o guarda quando o detalhe recarrega (RNF28). */
  commentText: string;
  onCommentTextChange: (text: string) => void;
}

/**
 * A Linha do Tempo da Atividade (RF30): o campo de novo comentário no topo e os eventos do mais
 * recente ao mais antigo, de 10 em 10, carregados ao rolar perto do fim ou pelo botão. A posição
 * da rolagem não vai para a URL.
 */
export function ActivityTimeline({
  activityId,
  currentUserId,
  completed,
  commentText,
  onCommentTextChange,
}: ActivityTimelineProps) {
  const timeline = useActivityTimeline(activityId);
  const sentinel = useRef<HTMLDivElement>(null);
  const { state, loadMore, loadingMore, moreFailed } = timeline;
  const canLoadMore = state.status === 'ready' && state.hasMore;

  // Perto do fim da lista, traz o trecho seguinte; depois de uma falha, só o botão tenta de novo.
  useEffect(() => {
    const target = sentinel.current;
    if (!canLoadMore || moreFailed || !target) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMore, moreFailed, loadMore]);

  return (
    <Section title="Linha do tempo">
      <NewComment
        activityId={activityId}
        completed={completed}
        text={commentText}
        onTextChange={onCommentTextChange}
        onSent={() => void timeline.reload().catch(() => undefined)}
      />
      {state.status === 'loading' && (
        <Stack sx={{ alignItems: 'center', py: 2 }}>
          <CircularProgress aria-label="Carregando a linha do tempo" />
        </Stack>
      )}
      {state.status === 'error' && (
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Alert severity="error" sx={{ alignSelf: 'stretch' }}>
            {state.message}
          </Alert>
          <Button variant="outlined" onClick={() => void timeline.load()}>
            Tentar novamente
          </Button>
        </Stack>
      )}
      {state.status === 'ready' && (
        <>
          <Stack
            direction="row"
            useFlexGap
            sx={{
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography color="text.secondary">
              Mais recente primeiro
            </Typography>
            <Typography role="status" color="text.secondary">
              {`${state.items.length} de ${state.count} eventos carregados`}
            </Typography>
          </Stack>
          <Stack
            component="ol"
            spacing={1}
            aria-label="Eventos da atividade"
            sx={{ m: 0, p: 0 }}
          >
            {state.items.map((event) => (
              <TimelineEventCard
                key={event.index}
                event={event}
                activityId={activityId}
                own={event.author.id === currentUserId}
              />
            ))}
          </Stack>
          {state.hasMore ? (
            <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Box ref={sentinel} sx={{ height: 1, width: 1 }} aria-hidden />
              {loadingMore && (
                <CircularProgress
                  size={24}
                  aria-label="Carregando mais eventos"
                />
              )}
              {moreFailed && (
                <Alert severity="error">
                  Não foi possível carregar mais eventos. Tente novamente.
                </Alert>
              )}
              <Button
                variant="outlined"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                Carregar mais eventos
              </Button>
            </Stack>
          ) : (
            <Typography color="text.secondary">Início do histórico</Typography>
          )}
        </>
      )}
    </Section>
  );
}
