import { DashboardScreen } from '../dashboard/DashboardScreen';
import { StudentDashboardView } from '../dashboard/StudentDashboardView';
import { getStudentDashboard } from '../services/dashboardService';

/** A Dashboard do aluno (RF50), a tela inicial da área do aluno. */
export function StudentDashboardPage() {
  return (
    <DashboardScreen load={getStudentDashboard}>
      {(dashboard) => <StudentDashboardView dashboard={dashboard} />}
    </DashboardScreen>
  );
}
