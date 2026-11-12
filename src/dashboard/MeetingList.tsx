import { Link, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { formatDateTimeRange } from '../formatters/dateTime';
import type { DashboardMeeting } from '../services/dashboardService';
import { DashboardEmptyState } from './DashboardEmptyState';

interface MeetingListProps {
  items: readonly DashboardMeeting[];
  hasMore: boolean;
  /** A tela de reuniões da área de quem lê, para onde os dois links levam. */
  meetingsPath: string;
  /** Quem é o outro participante para quem lê: "Professor" para o aluno, "Orientando" para o professor. */
  partyLabel: string;
}

/**
 * As próximas reuniões aceitas de uma Dashboard (RF50 e RF51): a data e o horário no fuso da
 * instituição, o outro participante e a descrição já resumida pelo servidor. O link para a tela
 * de reuniões fica sempre à vista, e "Ver todas" só aparece quando há mais itens que o limite.
 */
export function MeetingList({
  items,
  hasMore,
  meetingsPath,
  partyLabel,
}: MeetingListProps) {
  return (
    <Stack spacing={1}>
      {items.length === 0 ? (
        <DashboardEmptyState>
          Você não possui reuniões agendadas.
        </DashboardEmptyState>
      ) : (
        <Stack component="ul" spacing={1} sx={{ m: 0, p: 0 }}>
          {items.map((meeting) => (
            <Paper
              key={meeting.id}
              component="li"
              variant="outlined"
              sx={{ p: 2, listStyle: 'none' }}
            >
              <Stack spacing={0.5}>
                <Typography
                  component="time"
                  dateTime={meeting.scheduledAt}
                  sx={{ fontWeight: 'medium' }}
                >
                  {formatDateTimeRange(meeting.scheduledAt, meeting.endsAt)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {partyLabel}: {meeting.partyName}
                </Typography>
                <Typography sx={{ overflowWrap: 'anywhere' }}>
                  {meeting.description}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
      <Stack direction="row" useFlexGap sx={{ gap: 2, flexWrap: 'wrap' }}>
        <Link component={RouterLink} to={meetingsPath}>
          Ir para as reuniões
        </Link>
        {hasMore && (
          <Link component={RouterLink} to={meetingsPath}>
            Ver todas
          </Link>
        )}
      </Stack>
    </Stack>
  );
}
