import { Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { formatShortDate } from '../formatters/dateTime';
import type { AdvisingReport } from '../services/advisingReportService';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" component="p">
        {value}
      </Typography>
    </div>
  );
}

/**
 * O cabeçalho do relatório (RF61): a outra parte, a situação, o tema congelado, as datas e o
 * motivo do encerramento (RN33).
 */
export function ReportHeader({ report }: { report: AdvisingReport }) {
  return (
    <Paper variant="outlined" component="section" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Typography
            variant="h5"
            component="h2"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {report.counterpart.fullName}
          </Typography>
          <Chip
            label="Encerrada"
            color="success"
            size="small"
            variant="outlined"
          />
        </Stack>
        <div>
          <Typography variant="body2" color="text.secondary">
            Tema da orientação
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {report.thesisTopic ?? 'Sem tema cadastrado'}
          </Typography>
        </div>
        <Divider />
        <Stack direction="row" sx={{ gap: 4, flexWrap: 'wrap' }}>
          <Fact label="Início" value={formatShortDate(report.startedAt)} />
          <Fact label="Encerramento" value={formatShortDate(report.endedAt)} />
        </Stack>
        <Divider />
        <div>
          <Typography variant="body2" color="text.secondary">
            Motivo do encerramento
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {report.reason}
          </Typography>
        </div>
      </Stack>
    </Paper>
  );
}
