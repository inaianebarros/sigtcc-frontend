import { Box, Button, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatDate, formatDeadline } from '../formatters/dateTime';
import { formatFileSize } from '../formatters/fileSize';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import type { ActivityDetail } from '../services/activityService';
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

/** Um ponto de encaixe de uma funcionalidade que chega depois (status, comentários e revisão). */
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

interface ActivityDetailViewProps {
  activity: ActivityDetail;
  /** O professor orientador pode editar e excluir; o aluno só lê. */
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ActivityDetailView({
  activity,
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
                <li key={file.id}>
                  <Typography component="span">{file.fileName}</Typography>
                  <Typography component="span" color="text.secondary">
                    {` (${formatFileSize(file.sizeBytes)}, ${file.contentType})`}
                  </Typography>
                </li>
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
            {activity.reviews.map((review) => (
              <li key={review.id}>
                {DECISION_LABELS[review.decision]} em{' '}
                {formatDate(review.decidedAt)}
              </li>
            ))}
          </Box>
        )}
      </Section>
      <ExtensionPoint title="Status e entrega" />
      <ExtensionPoint title="Comentários">
        <Typography>
          {activity.commentsCount === 0
            ? 'Nenhum comentário'
            : `${activity.commentsCount} ${activity.commentsCount === 1 ? 'comentário' : 'comentários'}`}
        </Typography>
      </ExtensionPoint>
      <ExtensionPoint title="Revisão" />
    </>
  );
}
