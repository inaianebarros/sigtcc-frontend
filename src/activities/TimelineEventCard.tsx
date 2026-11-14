import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { formatDateTime } from '../formatters/dateTime';
import {
  downloadReviewFile,
  downloadSubmissionFile,
} from '../services/activityService';
import type { SubmissionFile } from '../services/activityService';
import type { TimelineEvent } from '../services/activityTimelineService';
import { AttachedFileItem } from './AttachedFileItem';
import { STATUS_LABELS } from './activityStatus';

const AUTHOR_LABELS = { student: 'Aluno', teacher: 'Professor' } as const;

function titleOf(event: TimelineEvent): string {
  switch (event.type) {
    case 'created':
      return 'Atividade criada';
    case 'delivery':
      return `Entrega — Versão ${event.version}`;
    case 'status_change':
      return `Situação alterada para ${STATUS_LABELS[event.status]}`;
    case 'sent_for_review':
      return 'Enviada para revisão';
    case 'comment':
      return 'Comentário';
    case 'review':
      return `Avaliação da versão ${event.version}`;
  }
}

function Files({
  files,
  label,
  load,
}: {
  files: SubmissionFile[];
  label: string;
  load: (file: SubmissionFile) => Promise<Blob>;
}) {
  if (files.length === 0) return null;
  return (
    <Box component="ul" aria-label={label} sx={{ m: 0, pl: 3 }}>
      {files.map((file) => (
        <AttachedFileItem key={file.id} file={file} load={() => load(file)} />
      ))}
    </Box>
  );
}

function Badge({ event }: { event: TimelineEvent }) {
  if (event.type === 'delivery' && event.awaitingReview) {
    return (
      <Chip
        size="small"
        color="primary"
        variant="outlined"
        label="Aguardando avaliação"
      />
    );
  }
  if (event.type === 'review') {
    return event.decision === 'accepted' ? (
      <Chip size="small" color="success" variant="outlined" label="Aceita" />
    ) : (
      <Chip size="small" color="error" variant="outlined" label="Recusada" />
    );
  }
  return null;
}

function Body({
  event,
  activityId,
}: {
  event: TimelineEvent;
  activityId: number;
}) {
  switch (event.type) {
    case 'comment':
      return (
        <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {event.text}
        </Typography>
      );
    case 'delivery':
      return (
        <Files
          files={event.files}
          label={`Arquivos da versão ${event.version}`}
          load={(file) => downloadSubmissionFile(activityId, file.id)}
        />
      );
    case 'review':
      return (
        <>
          {event.justification && (
            <Typography
              sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
            >
              {event.justification}
            </Typography>
          )}
          <Files
            files={event.files}
            label={`Anexos da avaliação da versão ${event.version}`}
            load={(file) => downloadReviewFile(activityId, event.id, file.id)}
          />
        </>
      );
    default:
      return null;
  }
}

interface TimelineEventCardProps {
  event: TimelineEvent;
  activityId: number;
  /** O evento é do usuário que lê a tela. */
  own: boolean;
}

/**
 * Um Evento da Atividade (RF30): o número, o título pelo tipo, o selo quando há, a data com hora
 * no horário da instituição, quem agiu e o conteúdo, com os arquivos para baixar.
 */
export function TimelineEventCard({
  event,
  activityId,
  own,
}: TimelineEventCardProps) {
  return (
    <Paper component="li" variant="outlined" sx={{ p: 2, listStyle: 'none' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box
          role="img"
          aria-label={`Evento ${event.index}`}
          sx={{
            flexShrink: 0,
            minWidth: 32,
            height: 32,
            px: 0.5,
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.dark',
            color: 'primary.contrastText',
            fontWeight: 'bold',
          }}
        >
          <span aria-hidden>{event.index}</span>
        </Box>
        <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            useFlexGap
            sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
          >
            <Typography
              variant="subtitle1"
              component="h3"
              sx={{ fontWeight: 'medium' }}
            >
              {titleOf(event)}
            </Typography>
            <Badge event={event} />
          </Stack>
          <Stack
            direction="row"
            useFlexGap
            sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
          >
            <Typography>{event.author.fullName}</Typography>
            <Chip
              size="small"
              variant="outlined"
              label={AUTHOR_LABELS[event.author.type]}
            />
            {own && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label="Você"
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(event.occurredAt)}
            </Typography>
          </Stack>
          <Body event={event} activityId={activityId} />
        </Stack>
      </Stack>
    </Paper>
  );
}
