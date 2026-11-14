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
  formatDeadline,
  formatDeadlineShort,
  formatDateTimeRange,
} from '../formatters/dateTime';
import type {
  AdvisingRecord,
  RecordActivityStatus,
} from '../services/advisingRecordsService';

const ACTIVITY_STATUS_LABELS: Record<RecordActivityStatus, string> = {
  completed: 'Concluída',
  archived: 'Arquivada',
};

const MEETING_RECORD_TITLE = 'Reunião realizada';

function recordTitle(record: AdvisingRecord): string {
  return record.type === 'meeting' ? MEETING_RECORD_TITLE : record.title;
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

/** O que o cartão aberto acrescenta ao fechado: a reunião, o horário e os apontamentos. */
function RecordDetails({ record }: { record: AdvisingRecord }) {
  if (record.type === 'meeting') {
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
  return (
    <Stack spacing={1.5}>
      <Detail label="Prazo">{formatDeadline(record.deadline)}</Detail>
      <Detail label="Situação">{ACTIVITY_STATUS_LABELS[record.status]}</Detail>
    </Stack>
  );
}

/**
 * Um registro do relatório (RF61), só para leitura: fechado, o tipo, a data, o título e duas linhas
 * da descrição; aberto no próprio lugar, a descrição completa e os detalhes de cada tipo. A reunião
 * não tem título próprio, por isso o fixo "Reunião realizada".
 */
export function RecordCard({ record }: { record: AdvisingRecord }) {
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
              {formatDeadlineShort(record.date)}
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
          {record.type === 'activity' && !open && (
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
          <Collapse in={open} unmountOnExit id={detailsId}>
            <RecordDetails record={record} />
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
        </Stack>
      </CardContent>
    </Card>
  );
}
