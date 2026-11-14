import { Box, Button, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatDate, formatDeadline } from '../formatters/dateTime';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import type {
  ActivityDetail,
  StudentSettableStatus,
} from '../services/activityService';
import { ActivityTimeline } from './ActivityTimeline';
import { Section } from './Section';
import { StatusAndDelivery } from './StatusAndDelivery';
import { StatusWithBadge } from './StatusWithBadge';

export const COMPLETED_REASON = 'Atividade concluída não pode ser alterada';

interface ActivityActionsProps {
  completed: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** Editar e excluir (professor): ficam desabilitados, com o motivo à vista, quando concluída. */
function ActivityActions({
  completed,
  onEdit,
  onDelete,
}: ActivityActionsProps) {
  const reasonId = useId();
  return (
    <Stack spacing={1}>
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          disabled={completed}
          aria-disabled={completed}
          aria-describedby={completed ? reasonId : undefined}
          onClick={onEdit}
        >
          Editar
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={completed}
          aria-disabled={completed}
          aria-describedby={completed ? reasonId : undefined}
          onClick={onDelete}
        >
          Excluir
        </Button>
      </Stack>
      {completed && (
        <Typography id={reasonId} variant="body2" color="text.secondary">
          {COMPLETED_REASON}
        </Typography>
      )}
    </Stack>
  );
}

/** O que só o aluno da atividade faz nela (RF28 e RF31); o professor não recebe nada disto. */
export interface StudentActions {
  statusBusy: boolean;
  onChangeStatus: (status: StudentSettableStatus) => void;
  onDeliver: () => void;
  onSendForReview: () => void;
}

/** O que só o orientador faz com uma atividade em revisão (RF46): aceitar ou recusar. */
export interface ReviewActions {
  onAccept: () => void;
  onRefuse: () => void;
}

/** O painel da revisão: a decisão do orientador, com o material já na seção Entregas. */
function ReviewPanel({ onAccept, onRefuse }: ReviewActions) {
  return (
    <Section title="Revisão" nested>
      <Typography sx={{ fontWeight: 'medium' }}>
        Aguardando a sua revisão
      </Typography>
      <Typography color="text.secondary">
        Abra os arquivos na linha do tempo e decida: aceitar conclui a
        atividade; recusar a devolve ao aluno com uma justificativa.
      </Typography>
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={onAccept}>
          Aceitar
        </Button>
        <Button variant="outlined" color="error" onClick={onRefuse}>
          Recusar
        </Button>
      </Stack>
    </Section>
  );
}

export interface CommentsBinding {
  currentUserId: number | null;
  text: string;
  onTextChange: (text: string) => void;
}

interface ActivityDetailViewProps {
  activity: ActivityDetail;
  student?: StudentActions;
  /** Só o professor orientador revisa, e só enquanto a atividade está em revisão. */
  review?: ReviewActions;
  /** O que a seção de comentários recebe da tela: quem lê e o texto ainda não enviado (RNF28). */
  comments: CommentsBinding;
  /** O professor orientador pode editar e excluir; o aluno só lê. */
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ActivityDetailView({
  activity,
  student,
  review,
  comments,
  canManage,
  onEdit,
  onDelete,
}: ActivityDetailViewProps) {
  const facts: (readonly [string, ReactNode])[] = [
    [
      'Situação',
      <StatusWithBadge
        key="status"
        status={activity.status}
        overdue={activity.overdue}
        pill
      />,
    ],
    ['Prazo', formatDeadline(activity.deadline)],
    ['Aluno', activity.student.fullName],
    ...(activity.teacher
      ? ([['Orientador', activity.teacher.fullName]] as const)
      : []),
    ['Criada em', formatDate(activity.createdAt)],
  ];
  return (
    <>
      <Box component="section" aria-label="Resumo da atividade">
        <ReadOnlyFacts facts={facts} />
      </Box>
      <Section title="Descrição">
        <Typography
          sx={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            bgcolor: 'action.hover',
            borderLeft: 4,
            borderColor: 'primary.main',
            borderRadius: 1,
            p: 2,
          }}
        >
          {activity.description}
        </Typography>
      </Section>
      <Section title="Ações">
        {canManage && (
          <ActivityActions
            completed={activity.status === 'completed'}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
        {student && (
          <Section title="Status e entrega" nested>
            <StatusAndDelivery
              status={activity.status}
              statusBusy={student.statusBusy}
              hasDelivery={activity.submissions.length > 0}
              onChangeStatus={student.onChangeStatus}
              onDeliver={student.onDeliver}
              onSendForReview={student.onSendForReview}
            />
          </Section>
        )}
        {review && activity.status === 'in_review' && (
          <ReviewPanel {...review} />
        )}
      </Section>
      <ActivityTimeline
        activityId={activity.id}
        currentUserId={comments.currentUserId}
        completed={activity.status === 'completed'}
        commentText={comments.text}
        onCommentTextChange={comments.onTextChange}
      />
    </>
  );
}
