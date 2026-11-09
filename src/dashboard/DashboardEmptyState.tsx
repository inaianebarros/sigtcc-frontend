import { Typography } from '@mui/material';
import type { ReactNode } from 'react';

/** O estado vazio das Dashboards (RNF22): diz por que não há nada, em vez de deixar o espaço em branco. */
export function DashboardEmptyState({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary">{children}</Typography>;
}
