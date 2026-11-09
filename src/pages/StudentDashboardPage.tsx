import { Alert, Button, Stack } from '@mui/material';
import { DashboardHeader } from '../dashboard/DashboardHeader';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';
import { StudentDashboardView } from '../dashboard/StudentDashboardView';
import { useRefreshedLoad } from '../hooks/useRefreshedLoad';
import { useSession } from '../hooks/useSession';
import { getStudentDashboard } from '../services/dashboardService';

/**
 * A Dashboard do aluno (RF50), a tela inicial da área do aluno: um resumo da orientação ativa
 * com os números do servidor. Relê ao abrir e ao voltar para a aba, sem polling.
 */
export function StudentDashboardPage() {
  const { user } = useSession();
  const { state, retry } = useRefreshedLoad(getStudentDashboard);
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
      {state.status === 'ready' && (
        <StudentDashboardView dashboard={state.data} />
      )}
    </Stack>
  );
}
