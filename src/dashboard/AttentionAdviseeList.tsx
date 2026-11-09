import { Chip, Link, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  paths,
  teacherActivitiesOfStudentPath,
  teacherStudentPath,
} from '../navigation/paths';
import type { AttentionAdvisee } from '../services/dashboardService';
import { DashboardEmptyState } from './DashboardEmptyState';

function overdueText(count: number): string {
  if (count === 0) return 'Sem atrasadas';
  return `${count} ${count === 1 ? 'atrasada' : 'atrasadas'}`;
}

function inReviewText(count: number): string {
  return count === 0 ? 'Nenhuma em revisão' : `${count} em revisão`;
}

interface AttentionAdviseeListProps {
  /** Na ordem do servidor (RN38): a tela não reordena. */
  items: readonly AttentionAdvisee[];
  hasMore: boolean;
}

/**
 * Os orientandos que precisam de atenção (RN38): o nome com link para o perfil (RN32), o tema do
 * TCC e as quantidades de atividades atrasadas e em revisão, em texto e com o realce de cor
 * só como reforço. "Ver todos os orientandos" só aparece quando há mais itens que o limite.
 */
export function AttentionAdviseeList({
  items,
  hasMore,
}: AttentionAdviseeListProps) {
  if (items.length === 0) {
    return (
      <DashboardEmptyState>
        Nenhum orientando precisa de atenção agora.
      </DashboardEmptyState>
    );
  }
  return (
    <Stack spacing={1}>
      <Stack component="ul" spacing={1} sx={{ m: 0, p: 0 }}>
        {items.map((advisee) => (
          <Paper
            key={advisee.id}
            component="li"
            variant="outlined"
            sx={{
              p: 2,
              listStyle: 'none',
              borderLeftWidth: 4,
              borderLeftColor:
                advisee.overdueCount > 0 ? 'error.main' : 'text.secondary',
            }}
          >
            <Stack spacing={0.5}>
              <Link
                component={RouterLink}
                to={teacherStudentPath(advisee.id)}
                sx={{ overflowWrap: 'anywhere', fontWeight: 'medium' }}
              >
                {advisee.fullName}
              </Link>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {advisee.thesisTopic === null
                  ? 'Tema do TCC ainda não cadastrado.'
                  : `Tema do TCC: ${advisee.thesisTopic}`}
              </Typography>
              <Stack
                direction="row"
                useFlexGap
                sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}
              >
                <Chip
                  size="small"
                  variant="outlined"
                  color={advisee.overdueCount > 0 ? 'error' : 'default'}
                  label={overdueText(advisee.overdueCount)}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={inReviewText(advisee.inReviewCount)}
                />
                <Link
                  component={RouterLink}
                  to={teacherActivitiesOfStudentPath(advisee.id)}
                  variant="body2"
                >
                  Ver atividades
                </Link>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
      {hasMore && (
        <Link
          component={RouterLink}
          to={paths.teacherAdvisees}
          sx={{ alignSelf: 'flex-start' }}
        >
          Ver todos os orientandos
        </Link>
      )}
    </Stack>
  );
}
