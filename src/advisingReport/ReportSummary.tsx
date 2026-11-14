import { Paper, Stack, Typography } from '@mui/material';
import type { AdvisingReport } from '../services/advisingReportService';

/** O resumo do relatório: os três totais gerais, que não mudam com o filtro dos registros. */
export function ReportSummary({ report }: { report: AdvisingReport }) {
  const totals = [
    { label: 'Registros', value: report.recordsCount },
    { label: 'Reuniões', value: report.meetingsCount },
    { label: 'Atividades', value: report.activitiesCount },
  ];
  return (
    <Stack direction="row" spacing={2}>
      {totals.map(({ label, value }) => (
        <Paper
          key={label}
          variant="outlined"
          role="group"
          aria-label={label}
          sx={{ flex: 1, minWidth: 0, p: 2 }}
        >
          <Typography variant="h4" component="p">
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" aria-hidden>
            {label}
          </Typography>
        </Paper>
      ))}
    </Stack>
  );
}
