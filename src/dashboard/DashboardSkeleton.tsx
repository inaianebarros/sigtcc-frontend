import { Skeleton, Stack } from '@mui/material';

/** O esqueleto das Dashboards enquanto os dados chegam. */
export function DashboardSkeleton() {
  return (
    <Stack spacing={2} data-testid="dashboard-skeleton" aria-hidden>
      <Skeleton variant="rounded" height={96} />
      <Skeleton variant="rounded" height={120} />
      <Skeleton variant="rounded" height={32} />
      <Skeleton variant="rounded" height={200} />
    </Stack>
  );
}
