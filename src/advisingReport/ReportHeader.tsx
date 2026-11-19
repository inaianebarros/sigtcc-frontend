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
 * O cabeçalho do relatório (RF61): a outra parte, a situação, as datas, o motivo do encerramento
 * (RN33) e o tema congelado, nesta ordem. O rótulo da outra parte depende de quem lê.
 */
export function ReportHeader({
  report,
  counterpartLabel,
}: {
  report: AdvisingReport;
  counterpartLabel: string;
}) {
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
          <div>
            <Typography variant="body2" color="text.secondary">
              {counterpartLabel}
            </Typography>
            <Typography
              variant="h5"
              component="h2"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {report.counterpart.fullName}
            </Typography>
          </div>
          <Chip
            label="Encerrada"
            color="success"
            size="small"
            variant="outlined"
          />
        </Stack>
        <Stack direction="row" sx={{ gap: 4, flexWrap: 'wrap' }}>
          <Fact label="Iniciada em" value={formatShortDate(report.startedAt)} />
          <Fact label="Encerrada em" value={formatShortDate(report.endedAt)} />
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
        <Divider />
        <div>
          <Typography variant="body2" color="text.secondary">
            Tema da orientação
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {report.thesisTopic ?? 'Sem tema cadastrado'}
          </Typography>
        </div>
      </Stack>
    </Paper>
  );
}
