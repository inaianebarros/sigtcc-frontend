import { Alert, Button, Stack } from '@mui/material';
import type { ReactNode } from 'react';
import { useRefreshedLoad } from '../hooks/useRefreshedLoad';
import { useSession } from '../hooks/useSession';
import { DashboardHeader } from './DashboardHeader';
import { DashboardSkeleton } from './DashboardSkeleton';

interface DashboardScreenProps<T> {
  /** Lê a Dashboard do perfil na API. */
  load: () => Promise<T>;
  children: (dashboard: T) => ReactNode;
}

/**
 * A moldura das Dashboards (RF50 e RF51): o cabeçalho, o esqueleto, o erro com nova tentativa e,
 * pronto, o conteúdo de cada perfil. Relê ao abrir e ao voltar para a aba, sem polling.
 */
export function DashboardScreen<T>({
  load,
  children,
}: DashboardScreenProps<T>) {
  const { user } = useSession();
  const { state, retry } = useRefreshedLoad(load);
  return (
    <Stack spacing={3} sx={{ maxWidth: 960, mx: 'auto' }}>
      <DashboardHeader name={user?.fullName ?? null} />
      {state.status === 'loading' && <DashboardSkeleton />}
      {state.status === 'error' && (
        <Stack spacing={2}>
          <Alert severity="error">{state.message}</Alert>
          <Button onClick={retry} sx={{ alignSelf: 'flex-start' }}>
            Tentar novamente
          </Button>
        </Stack>
      )}
      {state.status === 'ready' && children(state.data)}
    </Stack>
  );
}
