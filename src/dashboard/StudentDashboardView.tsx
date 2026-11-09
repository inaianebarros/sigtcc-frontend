import { Box, Button, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Section } from '../activities/Section';
import { activityPath, paths, studentAdvisorPath } from '../navigation/paths';
import type {
  DashboardRequestState,
  StudentDashboard,
} from '../services/dashboardService';
import { ActivityList } from './ActivityList';
import { DashboardEmptyState } from './DashboardEmptyState';
import { IndicatorCard } from './IndicatorCard';
import { ProgressCard } from './ProgressCard';

const REQUEST_TEXTS: Record<
  DashboardRequestState,
  (teacher: string) => string
> = {
  pending: (teacher) => `Sua solicitação para ${teacher} aguarda resposta.`,
  rejected: (teacher) => `Sua solicitação para ${teacher} foi recusada.`,
  unanswered: (teacher) =>
    `Sua solicitação para ${teacher} não foi respondida.`,
};

const NO_ACTIVITIES_MESSAGE = 'Você ainda não possui atividades cadastradas.';

const INDICATOR_GRID = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    md: 'repeat(3, minmax(0, 1fr))',
  },
} as const;

function AdvisingCard({
  advising,
}: {
  advising: NonNullable<StudentDashboard['advising']>;
}) {
  return (
    <Section title="Orientação">
      <Stack spacing={1}>
        <Typography>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            Orientador:{' '}
          </Box>
          <Link
            component={RouterLink}
            to={studentAdvisorPath(advising.teacher.id)}
          >
            {advising.teacher.fullName}
          </Link>
        </Typography>
        {advising.thesisTopic === null ? (
          <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <Typography color="text.secondary">
              Tema do TCC ainda não cadastrado.
            </Typography>
            <Link component={RouterLink} to={paths.studentThesis}>
              Cadastrar tema
            </Link>
          </Stack>
        ) : (
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            <Box component="span" sx={{ color: 'text.secondary' }}>
              Tema do TCC:{' '}
            </Box>
            {advising.thesisTopic}
          </Typography>
        )}
      </Stack>
    </Section>
  );
}

function ActiveAdvisingView({
  dashboard,
  advising,
}: {
  dashboard: StudentDashboard;
  advising: NonNullable<StudentDashboard['advising']>;
}) {
  const { activities, nextActivities } = dashboard;
  const hasActivities = activities !== null && activities.total > 0;
  return (
    <>
      <AdvisingCard advising={advising} />
      {!hasActivities && (
        <DashboardEmptyState>{NO_ACTIVITIES_MESSAGE}</DashboardEmptyState>
      )}
      {hasActivities && (
        <>
          <Section title="Indicadores das atividades">
            <Box sx={INDICATOR_GRID}>
              <IndicatorCard
                label="Total de atividades"
                value={activities.total}
              />
              <IndicatorCard label="Pendentes" value={activities.pending} />
              <IndicatorCard
                label="Em andamento"
                value={activities.inProgress}
              />
              <IndicatorCard label="Em revisão" value={activities.inReview} />
              <IndicatorCard label="Concluídas" value={activities.completed} />
              <IndicatorCard
                label="Atrasadas"
                value={activities.overdue}
                alert
              />
            </Box>
          </Section>
          {activities.progressPercent !== null && (
            <ProgressCard percent={activities.progressPercent} />
          )}
          <Section title="Próximas atividades">
            <ActivityList
              items={nextActivities?.items ?? []}
              pathOf={(id) => activityPath('student', id)}
              hasMore={nextActivities?.hasMore ?? false}
              seeAllPath={paths.studentActivities}
              emptyText="Nenhuma atividade em aberto."
            />
          </Section>
        </>
      )}
    </>
  );
}

function WithoutAdvisingView({ dashboard }: { dashboard: StudentDashboard }) {
  const { lastRequest } = dashboard;
  const canSearch = lastRequest?.status !== 'pending';
  return (
    <Section title="Sem orientação ativa">
      <Typography>
        Você ainda não tem uma orientação ativa. As atividades, as reuniões e o
        tema do TCC ficam disponíveis depois que um professor aceitar a sua
        solicitação.
      </Typography>
      {lastRequest && (
        <Typography>
          {REQUEST_TEXTS[lastRequest.status](lastRequest.teacher.fullName)}
        </Typography>
      )}
      <Stack
        direction="row"
        useFlexGap
        sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}
      >
        {canSearch && (
          <Button
            component={RouterLink}
            to={paths.studentAdvisors}
            variant="contained"
          >
            Pesquisar orientadores
          </Button>
        )}
        {lastRequest && (
          <Link component={RouterLink} to={paths.studentRequest}>
            Ver minha solicitação
          </Link>
        )}
        {dashboard.hasEndedAdvisings && (
          <Link component={RouterLink} to={paths.studentAdvisingHistory}>
            Ver histórico de orientações
          </Link>
        )}
      </Stack>
    </Section>
  );
}

/** O conteúdo da Dashboard do aluno (RF50): com orientação ativa, ou a situação sem ela. */
export function StudentDashboardView({
  dashboard,
}: {
  dashboard: StudentDashboard;
}) {
  const { advising } = dashboard;
  if (dashboard.hasActiveAdvising && advising !== null) {
    return <ActiveAdvisingView dashboard={dashboard} advising={advising} />;
  }
  return <WithoutAdvisingView dashboard={dashboard} />;
}
