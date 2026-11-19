import { Paper, Stack, Typography } from '@mui/material';
import type { AdvisingReport } from '../services/advisingReportService';

/** O resumo do relatório: os dois totais gerais, que não mudam com o filtro da lista. */
export function ReportSummary({ report }: { report: AdvisingReport }) {
  const totals = [
    { label: 'Reuniões realizadas', value: report.meetingsCount },
    {
      label: 'Atividades concluídas ou arquivadas',
      value: report.activitiesCount,
    },
  ];
  return (
    <Stack spacing={2} component="section">
      <Typography variant="h6" component="h2">
        Resumo da orientação
      </Typography>
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
    </Stack>
  );
}
