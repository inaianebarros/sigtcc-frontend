import { Stack } from '@mui/material';
import { Section } from '../activities/Section';
import { activityPath, paths } from '../navigation/paths';
import type { TeacherDashboard } from '../services/dashboardService';
import { ActivityList } from './ActivityList';
import { AttentionAdviseeList } from './AttentionAdviseeList';
import { DashboardEmptyState } from './DashboardEmptyState';
import { IndicatorCard } from './IndicatorCard';
import { IndicatorGrid } from './IndicatorGrid';
import { MeetingList } from './MeetingList';
import { ProgressCard } from './ProgressCard';

const NO_ADVISEES_MESSAGE =
  'Você ainda não tem orientandos ativos. Quando aceitar uma solicitação de orientação, o resumo das suas orientações aparece aqui.';
const NO_ACTIVITIES_MESSAGE =
  'Os seus orientandos ainda não possuem atividades cadastradas.';

function ActiveAdviseesView({ dashboard }: { dashboard: TeacherDashboard }) {
  const { activities, attentionAdvisees, nextDeadlines } = dashboard;
  const hasActivities = activities !== null && activities.total > 0;
  // O resumo (indicadores e progresso) se lê junto, a 16 px; os blocos de lista, que são pesados,
  // se separam a 32 px.
  return (
    <Stack spacing={4}>
      <Stack spacing={2}>
        <Section title="Indicadores das orientações">
          <IndicatorGrid>
            <IndicatorCard
              label="Orientandos ativos"
              value={dashboard.adviseesCount}
            />
            {hasActivities && (
              <>
                <IndicatorCard
                  label="Total de atividades"
                  value={activities.total}
                />
                <IndicatorCard label="Pendentes" value={activities.pending} />
                <IndicatorCard
                  label="Em andamento"
                  value={activities.inProgress}
                />
                <IndicatorCard
                  label="Aguardando revisão"
                  value={activities.inReview}
                />
                <IndicatorCard
                  label="Concluídas"
                  value={activities.completed}
                />
                <IndicatorCard
                  label="Atrasadas"
                  value={activities.overdue}
                  alert
                />
              </>
            )}
          </IndicatorGrid>
        </Section>
        {!hasActivities && (
          <DashboardEmptyState>{NO_ACTIVITIES_MESSAGE}</DashboardEmptyState>
        )}
        {hasActivities && activities.progressPercent !== null && (
          <ProgressCard percent={activities.progressPercent} />
        )}
      </Stack>
      {hasActivities && (
        <>
          <Section title="Orientandos que precisam de atenção">
            <AttentionAdviseeList
              items={attentionAdvisees?.items ?? []}
              hasMore={attentionAdvisees?.hasMore ?? false}
            />
          </Section>
          <Section title="Próximos prazos">
            <ActivityList
              items={nextDeadlines?.items ?? []}
              pathOf={(id) => activityPath('teacher', id)}
              hasMore={nextDeadlines?.hasMore ?? false}
              seeAllPath={paths.teacherActivities}
              emptyText="Nenhuma atividade em aberto."
            />
          </Section>
        </>
      )}
      {dashboard.nextMeetings && (
        <Section title="Próximas reuniões">
          <MeetingList
            items={dashboard.nextMeetings.items}
            hasMore={dashboard.nextMeetings.hasMore}
            meetingsPath={paths.teacherMeetings}
            partyLabel="Orientando"
          />
        </Section>
      )}
    </Stack>
  );
}

/** O conteúdo da Dashboard do professor (RF51): o resumo das orientações ativas, ou o estado vazio. */
export function TeacherDashboardView({
  dashboard,
}: {
  dashboard: TeacherDashboard;
}) {
  const withoutAdvisees =
    dashboard.adviseesCount === 0 || dashboard.activities === null;
  return (
    <>
      {withoutAdvisees ? (
        <DashboardEmptyState>{NO_ADVISEES_MESSAGE}</DashboardEmptyState>
      ) : (
        <ActiveAdviseesView dashboard={dashboard} />
      )}
    </>
  );
}
