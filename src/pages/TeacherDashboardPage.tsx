import { DashboardScreen } from '../dashboard/DashboardScreen';
import { TeacherDashboardView } from '../dashboard/TeacherDashboardView';
import { getTeacherDashboard } from '../services/dashboardService';

/** A Dashboard do professor (RF51), a tela inicial da área do professor. */
export function TeacherDashboardPage() {
  return (
    <DashboardScreen load={getTeacherDashboard}>
      {(dashboard) => <TeacherDashboardView dashboard={dashboard} />}
    </DashboardScreen>
  );
}
