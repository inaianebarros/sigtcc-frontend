import { Skeleton, Stack } from '@mui/material';
import { VisuallyHidden } from '../components/VisuallyHidden';

/** O esqueleto das Dashboards enquanto os dados chegam, anunciado ao leitor de tela. */
export function DashboardSkeleton() {
  return (
    <Stack spacing={2} role="status" data-testid="dashboard-skeleton">
      <VisuallyHidden>Carregando a dashboard…</VisuallyHidden>
      <Skeleton variant="rounded" height={96} aria-hidden />
      <Skeleton variant="rounded" height={120} aria-hidden />
      <Skeleton variant="rounded" height={32} aria-hidden />
      <Skeleton variant="rounded" height={200} aria-hidden />
    </Stack>
  );
}
