import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material';
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
  /** Telas a partir de 600 px: o professor à esquerda, o aluno à direita e os números no centro. */
  split: boolean;
}

/** As cores de cada lado: o professor em azul e o aluno em roxo, ambos com texto branco a 4,5:1. */
/** O espaço entre os eventos do layout dividido, em unidades do tema; a linha central o atravessa. */
const ROW_SPACING = 2;

const SIDE_COLORS = { teacher: 'primary', student: 'secondary' } as const;

function Marker({
  event,
  color,
}: {
  event: TimelineEvent;
  color: (typeof SIDE_COLORS)[keyof typeof SIDE_COLORS];
}) {
  return (
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
        bgcolor: `${color}.dark`,
        color: `${color}.contrastText`,
        fontWeight: 'bold',
      }}
    >
      <span aria-hidden>{event.index}</span>
    </Box>
  );
}

function Details({
  event,
  activityId,
  own,
}: Omit<TimelineEventCardProps, 'split'>) {
  return (
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
          <Chip size="small" color="primary" variant="outlined" label="Você" />
        )}
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(event.occurredAt)}
        </Typography>
      </Stack>
      <Body event={event} activityId={activityId} />
    </Stack>
  );
}

/**
 * Um Evento da Atividade (RF30): o número, o título pelo tipo, o selo quando há, a data com hora
 * no horário da instituição, quem agiu e o conteúdo, com os arquivos para baixar. Em uma coluna
 * (celular) o número fica dentro do cartão; dividido (a partir de 600 px), o número vai para a
 * coluna central e o cartão para o lado de quem agiu. O documento mantém a mesma ordem nos dois.
 */
export function TimelineEventCard({
  event,
  activityId,
  own,
  split,
}: TimelineEventCardProps) {
  if (!split) {
    return (
      <Box component="li" sx={{ listStyle: 'none' }}>
        <Paper variant="outlined" data-card sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Marker event={event} color="primary" />
            <Details event={event} activityId={activityId} own={own} />
          </Stack>
        </Paper>
      </Box>
    );
  }
  const side = event.author.type;
  const color = SIDE_COLORS[side];
  return (
    <Box
      component="li"
      data-side={side}
      sx={{
        listStyle: 'none',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 64px minmax(0, 1fr)',
        pb: ROW_SPACING,
        // O último evento termina a linha no próprio número, sem avançar sobre o que vem depois.
        '&:last-of-type > div:first-of-type::before': { bottom: 0 },
      }}
    >
      <Box
        sx={{
          gridColumn: 2,
          gridRow: 1,
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          // A linha vertical que liga os números, também por baixo do espaço entre os cartões.
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: (theme: Theme) => `-${theme.spacing(ROW_SPACING)}`,
            width: 2,
            bgcolor: 'divider',
          },
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <Marker event={event} color={color} />
        </Box>
      </Box>
      <Paper
        variant="outlined"
        data-card
        sx={{
          gridColumn: side === 'teacher' ? 1 : 3,
          gridRow: 1,
          p: 2,
          borderWidth: 2,
          borderColor: `${color}.main`,
        }}
      >
        <Details event={event} activityId={activityId} own={own} />
      </Paper>
    </Box>
  );
}
