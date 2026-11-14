import {
  Alert,
  Button,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import type { LoadState } from '../hooks/useLoad';
import type { AdvisingHistorySummary } from '../services/advisingHistoryService';

interface HistoryTotalsProps {
  summary: LoadState<AdvisingHistorySummary>;
  /** Só o professor tem o total de orientandos ativos. */
  showActive: boolean;
  onRetry: () => void;
}

function totalsOf(summary: AdvisingHistorySummary, showActive: boolean) {
  const totals = [
    { label: 'Orientações encerradas', value: summary.endedCount },
  ];
  if (showActive && summary.activeCount !== null) {
    totals.push({ label: 'Orientandos', value: summary.activeCount });
  }
  return totals;
}

/**
 * Os totais gerais do topo do histórico: não mudam com a busca. Têm carregamento e erro próprios,
 * para que uma falha neles não derrube a lista, nem a da lista os totais.
 */
export function HistoryTotals({
  summary,
  showActive,
  onRetry,
}: HistoryTotalsProps) {
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
        {Array.from({ length: showActive ? 2 : 1 }, (_, index) => (
          <Skeleton
            key={index}
            variant="rounded"
            height={104}
            sx={{ flex: 1 }}
          />
        ))}
      </Stack>
    );
  }
  return (
    <Stack direction="row" spacing={2}>
      {totalsOf(summary.data, showActive).map(({ label, value }) => (
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
