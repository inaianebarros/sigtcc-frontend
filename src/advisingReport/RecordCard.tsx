import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Stack,
  Typography,
} from '@mui/material';
import { useId, useState } from 'react';
import { VisuallyHidden } from '../components/VisuallyHidden';
import {
  formatDeadlineShort,
  formatDateTimeRange,
} from '../formatters/dateTime';
import { useSession } from '../hooks/useSession';
import { OriginLink } from '../navigation/OriginLink';
import { reportActivityPath } from '../navigation/paths';
import type {
  AdvisingRecord,
  MeetingRecord,
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

function Detail({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>
        {children}
      </Typography>
    </div>
  );
}

/** O que o cartão aberto da reunião acrescenta ao fechado: o horário e os apontamentos. */
function MeetingDetails({ record }: { record: MeetingRecord }) {
  return (
    <Stack spacing={1.5}>
      <Detail label="Horário">
        {formatDateTimeRange(record.startsAt, record.endsAt)}
      </Detail>
      <Detail label="Apontamentos">
        {record.notes || 'Sem apontamentos registrados.'}
      </Detail>
    </Stack>
  );
}

/** "Ver atividade →", que abre a atividade só para leitura, com o relatório como origem (RNF30). */
function ActivityLink({
  advisingId,
  record,
}: {
  advisingId: number;
  record: AdvisingRecord;
}) {
  const { user } = useSession();
  const to = reportActivityPath(
    user?.type === 'teacher' ? 'teacher' : 'student',
    advisingId,
    record.id,
  );
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
      Ver atividade <span aria-hidden>→</span>{' '}
      <VisuallyHidden>{recordTitle(record)}</VisuallyHidden>
    </OriginLink>
  );
}

/**
 * Um registro do relatório (RF61), só para leitura: o tipo, a data, o título e duas linhas da
 * descrição. A atividade abre na sua própria tela, por "Ver atividade"; a reunião abre no próprio
 * lugar, com o horário e os apontamentos. A reunião não tem título próprio, por isso o título é
 * "Reunião de" e a data.
 */
export function RecordCard({
  advisingId,
  record,
}: {
  advisingId: number;
  record: AdvisingRecord;
}) {
  const titleId = useId();
  const detailsId = useId();
  const [open, setOpen] = useState(false);
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
            sx={[
              { overflowWrap: 'anywhere', whiteSpace: 'pre-line' },
              !open && {
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              },
            ]}
          >
            {record.description}
          </Typography>
          {record.type === 'activity' ? (
            <ActivityLink advisingId={advisingId} record={record} />
          ) : (
            <>
              <Collapse in={open} unmountOnExit id={detailsId}>
                <MeetingDetails record={record} />
              </Collapse>
              <Button
                size="small"
                aria-expanded={open}
                aria-controls={detailsId}
                endIcon={
                  <ExpandMoreIcon
                    sx={{
                      transform: open ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms',
                    }}
                  />
                }
                onClick={() => setOpen((current) => !current)}
                sx={{ alignSelf: 'flex-end' }}
              >
                {open ? 'Ocultar detalhes' : 'Ver detalhes'}
                <VisuallyHidden> de {recordTitle(record)}</VisuallyHidden>
              </Button>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
