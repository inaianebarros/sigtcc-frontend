import { Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { formatDeadlineShort } from '../formatters/dateTime';
import { useSession } from '../hooks/useSession';
import { OriginLink } from '../navigation/OriginLink';
import { reportActivityPath, reportMeetingPath } from '../navigation/paths';
import type {
  AdvisingRecord,
  RecordActivityStatus,
} from '../services/advisingRecordsService';

const ACTIVITY_STATUS_LABELS: Record<RecordActivityStatus, string> = {
  completed: 'Concluída',
  archived: 'Arquivada',
};

function recordTitle(record: AdvisingRecord): string {
  return record.type === 'meeting'
    ? `Reunião de ${formatDeadlineShort(record.date)}`
    : record.title;
}

function recordDateText(record: AdvisingRecord): string {
  const date = formatDeadlineShort(record.date);
  return record.type === 'meeting' ? `Realizada em ${date}` : `Prazo: ${date}`;
}

/**
 * "Ver atividade →" ou "Ver reunião →", que abre o item só para leitura, com o relatório como
 * origem (RNF30). O leitor de tela ouve o título do item, e não a seta.
 */
function RecordLink({
  advisingId,
  record,
}: {
  advisingId: number;
  record: AdvisingRecord;
}) {
  const { user } = useSession();
  const userType = user?.type === 'teacher' ? 'teacher' : 'student';
  const isMeeting = record.type === 'meeting';
  const to = isMeeting
    ? reportMeetingPath(userType, advisingId, record.id)
    : reportActivityPath(userType, advisingId, record.id);
  return (
    <OriginLink
      to={to}
      sx={{
        alignSelf: 'flex-end',
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: { xs: 44, sm: 24 },
      }}
    >
      {isMeeting ? 'Ver reunião' : 'Ver atividade'} <span aria-hidden>→</span>{' '}
      <VisuallyHidden>{recordTitle(record)}</VisuallyHidden>
    </OriginLink>
  );
}

/**
 * Um registro do relatório (RF61), só para leitura: o tipo, a data, o título, a situação da
 * atividade e duas linhas da descrição. Cada item abre na sua própria tela de leitura. A reunião
 * não tem título próprio, por isso o título é "Reunião de" e a data.
 */
export function RecordCard({
  advisingId,
  record,
}: {
  advisingId: number;
  record: AdvisingRecord;
}) {
  const titleId = useId();
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Chip
              label={record.type === 'meeting' ? 'Reunião' : 'Atividade'}
              color={record.type === 'meeting' ? 'primary' : 'success'}
              size="small"
              variant="outlined"
            />
            <Typography color="text.secondary">
              {recordDateText(record)}
            </Typography>
          </Stack>
          <Typography
            id={titleId}
            variant="h6"
            component="h4"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {recordTitle(record)}
          </Typography>
          {record.type === 'activity' && (
            <Typography color="text.secondary">
              {ACTIVITY_STATUS_LABELS[record.status]}
            </Typography>
          )}
          <Typography
            color="text.secondary"
            sx={{
              overflowWrap: 'anywhere',
              whiteSpace: 'pre-line',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {record.description}
          </Typography>
          <RecordLink advisingId={advisingId} record={record} />
        </Stack>
      </CardContent>
    </Card>
  );
}
