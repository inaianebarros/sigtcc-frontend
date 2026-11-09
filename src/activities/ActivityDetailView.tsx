import { Box, Button, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatDate, formatDeadline } from '../formatters/dateTime';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import type {
  ActivityDetail,
  StudentSettableStatus,
} from '../services/activityService';
import { StatusAndDelivery } from './StatusAndDelivery';
import { SubmissionFileItem } from './SubmissionFileItem';
import { StatusWithBadge } from './StatusWithBadge';

export const COMPLETED_REASON = 'Atividade concluída não pode ser alterada';

const DECISION_LABELS = { accepted: 'Aceita', rejected: 'Recusada' } as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <Box component="section" aria-labelledby={id}>
      <Stack spacing={1}>
        <Typography id={id} variant="h6" component="h2">
          {title}
        </Typography>
        {children}
      </Stack>
    </Box>
  );
}

/** Um ponto de encaixe de uma funcionalidade que chega depois (os comentários). */
function ExtensionPoint({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Section title={title}>
      {children}
      <Typography color="text.secondary">Disponível em breve</Typography>
    </Section>
  );
}

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
    <Section title="Revisão">
      <Typography sx={{ fontWeight: 'medium' }}>
        Aguardando a sua revisão
      </Typography>
      <Typography color="text.secondary">
        Abra os arquivos na seção Entregas e decida: aceitar conclui a
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

interface ActivityDetailViewProps {
  activity: ActivityDetail;
  student?: StudentActions;
  /** Só o professor orientador revisa, e só enquanto a atividade está em revisão. */
  review?: ReviewActions;
  /** O professor orientador pode editar e excluir; o aluno só lê. */
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ActivityDetailView({
  activity,
  student,
  review,
  canManage,
  onEdit,
  onDelete,
}: ActivityDetailViewProps) {
  const facts: (readonly [string, ReactNode])[] = [
    ['Aluno', activity.student.fullName],
    ...(activity.teacher
      ? ([['Orientador', activity.teacher.fullName]] as const)
      : []),
    ['Prazo', formatDeadline(activity.deadline)],
    [
      'Situação',
      <StatusWithBadge
        key="status"
        status={activity.status}
        overdue={activity.overdue}
      />,
    ],
    ['Criada em', formatDate(activity.createdAt)],
  ];
  return (
    <>
      {canManage && (
        <ActivityActions
          completed={activity.status === 'completed'}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>
        {activity.description}
      </Typography>
      <ReadOnlyFacts facts={facts} />
      <Section title="Entregas">
        {activity.submissions.length === 0 && (
          <Typography>Nenhuma entrega ainda.</Typography>
        )}
        {activity.submissions.map((submission) => (
          <Stack key={submission.id} spacing={0.5}>
            <Typography>
              Enviada em {formatDate(submission.submittedAt)}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              {submission.files.map((file) => (
                <SubmissionFileItem
                  key={file.id}
                  activityId={activity.id}
                  file={file}
                />
              ))}
            </Box>
          </Stack>
        ))}
      </Section>
      <Section title="Revisões">
        {activity.reviews.length === 0 && (
          <Typography>Nenhuma revisão ainda.</Typography>
        )}
        {activity.reviews.length > 0 && (
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {activity.reviews.map((item) => (
              <li key={item.id}>
                {DECISION_LABELS[item.decision]} em {formatDate(item.decidedAt)}
                {item.justification && (
                  <Typography
                    component="p"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {item.justification}
                  </Typography>
                )}
              </li>
            ))}
          </Box>
        )}
      </Section>
      {student && (
        <Section title="Status e entrega">
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
      <ExtensionPoint title="Comentários">
        <Typography>
          {activity.commentsCount === 0
            ? 'Nenhum comentário'
            : `${activity.commentsCount} ${activity.commentsCount === 1 ? 'comentário' : 'comentários'}`}
        </Typography>
      </ExtensionPoint>
      {review && activity.status === 'in_review' && <ReviewPanel {...review} />}
    </>
  );
}
