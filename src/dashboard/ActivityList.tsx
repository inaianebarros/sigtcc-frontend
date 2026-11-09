import { Link, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { StatusWithBadge } from '../activities/StatusWithBadge';
import { formatDeadline } from '../formatters/dateTime';
import type { DashboardActivity } from '../services/dashboardService';
import { DashboardEmptyState } from './DashboardEmptyState';

interface ActivityListProps {
  items: readonly DashboardActivity[];
  /** O caminho dos detalhes de uma atividade, que depende da área de quem lê. */
  pathOf: (activityId: number) => string;
  hasMore: boolean;
  /** Para onde "Ver todas" leva: a lista completa de atividades. */
  seeAllPath: string;
  emptyText: string;
}

/**
 * A lista curta de atividades da Dashboard: título com link para os detalhes, prazo, situação e o
 * selo de atraso. "Ver todas" só aparece quando há mais itens que o limite.
 */
export function ActivityList({
  items,
  pathOf,
  hasMore,
  seeAllPath,
  emptyText,
}: ActivityListProps) {
  if (items.length === 0) {
    return <DashboardEmptyState>{emptyText}</DashboardEmptyState>;
  }
  return (
    <Stack spacing={1}>
      <Stack component="ul" spacing={1} sx={{ m: 0, p: 0 }}>
        {items.map((item) => (
          <Paper
            key={item.id}
            component="li"
            variant="outlined"
            sx={{ p: 2, listStyle: 'none' }}
          >
            <Stack spacing={0.5}>
              <Link
                component={RouterLink}
                to={pathOf(item.id)}
                sx={{ overflowWrap: 'anywhere', fontWeight: 'medium' }}
              >
                {item.title}
              </Link>
              {item.student && (
                <Typography variant="body2" color="text.secondary">
                  Orientando: {item.student.fullName}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                Prazo: {formatDeadline(item.deadline)}
              </Typography>
              <StatusWithBadge status={item.status} overdue={item.overdue} />
            </Stack>
          </Paper>
        ))}
      </Stack>
      {hasMore && (
        <Link
          component={RouterLink}
          to={seeAllPath}
          sx={{ alignSelf: 'flex-start' }}
        >
          Ver todas
        </Link>
      )}
    </Stack>
  );
}
