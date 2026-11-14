import {
  Alert,
  Button,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import type { LoadState } from '../hooks/useLoad';
import type { ActivitySummary } from '../services/activityService';

const TOTALS: { label: string; value: (summary: ActivitySummary) => number }[] =
  [
    { label: 'Total de atividades', value: (summary) => summary.total },
    { label: 'Concluídas', value: (summary) => summary.completed },
    { label: 'Pendentes', value: (summary) => summary.pending },
  ];

interface ActivityTotalsProps {
  summary: LoadState<ActivitySummary>;
  onRetry: () => void;
}

/**
 * Os três totais gerais, lado a lado. Têm carregamento e erro próprios: uma falha neles não
 * derruba a lista, e a da lista não derruba os totais.
 */
export function ActivityTotals({ summary, onRetry }: ActivityTotalsProps) {
  if (summary.status === 'error') {
    return (
      <Stack spacing={1}>
        <Alert severity="error">{summary.message}</Alert>
        <Button onClick={onRetry} sx={{ alignSelf: 'flex-start' }}>
          Tentar novamente
        </Button>
      </Stack>
    );
  }
  if (summary.status !== 'ready') {
    return (
      <Stack
        direction="row"
        spacing={2}
        data-testid="totals-skeleton"
        aria-hidden
      >
        {TOTALS.map(({ label }) => (
          <Skeleton
            key={label}
            variant="rounded"
            height={88}
            sx={{ flex: 1 }}
          />
        ))}
      </Stack>
    );
  }
  return (
    <Stack direction="row" spacing={2}>
      {TOTALS.map(({ label, value }) => (
        <Paper
          key={label}
          variant="outlined"
          role="group"
          aria-label={label}
          sx={{ flex: 1, minWidth: 0, p: 2 }}
        >
          <Typography variant="body2" color="text.secondary" aria-hidden>
            {label}
          </Typography>
          <Typography variant="h4" component="p">
            {value(summary.data)}
          </Typography>
        </Paper>
      ))}
    </Stack>
  );
}
