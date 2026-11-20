import { Box, Button, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatDate, formatDeadline } from '../formatters/dateTime';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import type {
  ActivityDetail,
  ReportScope,
  StudentSettableStatus,
} from '../services/activityService';
import { DETAIL_STATUS_LABELS } from './activityStatus';
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
      <Typography>
        O aluno enviou esta atividade para revisão. Confira a entrega mais
        recente na linha do tempo e decida. Aceitar conclui a atividade. Recusar
        a devolve ao aluno, com uma justificativa.
      </Typography>
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={onAccept}>
          Aceitar atividade
        </Button>
        <Button variant="outlined" color="error" onClick={onRefuse}>
          Recusar atividade
        </Button>
      </Stack>
    </Section>
  );
}

/** O texto ainda não enviado do novo comentário, que vive na tela (RNF28). */
export interface CommentsBinding {
  text: string;
  onTextChange: (text: string) => void;
}

/** Editar e excluir, que só o professor orientador faz. */
export interface ManageActions {
  onEdit: () => void;
  onDelete: () => void;
}

interface ActivityDetailViewProps {
  activity: ActivityDetail;
  /** Quem lê, para a linha do tempo marcar os próprios eventos com "Você". */
  currentUserId: number | null;
  student?: StudentActions;
  /** Só o professor orientador revisa, e só enquanto a atividade está em revisão. */
  review?: ReviewActions;
  /** O professor orientador pode editar e excluir; o aluno só lê. */
  manage?: ManageActions;
  /** O novo comentário; sem ele, a linha do tempo não aceita comentário. */
  comments?: CommentsBinding;
  /** A atividade lida pelo relatório de uma orientação encerrada, só para leitura (RF61). */
  report?: ReportScope;
}

/**
 * O detalhe de uma atividade (RF30): o resumo, a descrição, as ações de quem pode agir e a linha
 * do tempo. Sem ações e sem comentário, é a leitura da atividade pelo relatório (RF61).
 */
export function ActivityDetailView({
  activity,
  currentUserId,
  student,
  review,
  manage,
  comments,
  report,
}: ActivityDetailViewProps) {
  const { status } = activity;
  const facts: (readonly [string, ReactNode])[] = [
    [
      'Situação',
      status === 'archived' ? (
        DETAIL_STATUS_LABELS.archived
      ) : (
        <StatusWithBadge
          key="status"
          status={status}
          overdue={activity.overdue}
          pill
        />
      ),
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
      {(manage || student || review) && (
        <Section title="Ações">
          {manage && (
            <ActivityActions
              completed={status === 'completed'}
              onEdit={manage.onEdit}
              onDelete={manage.onDelete}
            />
          )}
          {student && status !== 'archived' && (
            <Section title="Situação e entrega" nested>
              <StatusAndDelivery
                status={status}
                statusBusy={student.statusBusy}
                hasDelivery={activity.submissions.length > 0}
                onChangeStatus={student.onChangeStatus}
                onDeliver={student.onDeliver}
                onSendForReview={student.onSendForReview}
              />
            </Section>
          )}
          {review && status === 'in_review' && <ReviewPanel {...review} />}
        </Section>
      )}
      <ActivityTimeline
        activityId={activity.id}
        currentUserId={currentUserId}
        report={report}
        comment={
          comments && {
            completed: status === 'completed',
            text: comments.text,
            onTextChange: comments.onTextChange,
          }
        }
      />
    </>
  );
}
