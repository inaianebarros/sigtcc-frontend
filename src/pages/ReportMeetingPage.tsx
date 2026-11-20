import { Stack } from '@mui/material';
import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { formatDeadlineShort } from '../formatters/dateTime';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { MeetingDetails } from '../meetings/MeetingDetails';
import { reportOriginPath } from '../navigation/origin';
import { advisingReportPath } from '../navigation/paths';
import { positiveIntFrom } from '../navigation/positiveInt';
import { ProfileView } from '../profile/ProfileView';
import { nullOnNotFound } from '../services/apiError';
import { getReportMeeting } from '../services/meetingService';

/**
 * Uma reunião realizada de uma orientação encerrada, aberta pelo relatório (RF61): o mesmo conteúdo
 * do modal da reunião, numa página e sem ações. Carrega uma vez, porque nada nela muda mais, e o
 * acesso segue o do relatório (RN47): qualquer 404 é "Reunião não encontrada", sem o motivo.
 */
export function ReportMeetingPage() {
  const params = useParams();
  const advisingId = positiveIntFrom(params.advisingId);
  const meetingId = positiveIntFrom(params.meetingId);
  const { user } = useSession();
  const reportPath = advisingReportPath(
    user?.type === 'teacher' ? 'teacher' : 'student',
    advisingId ?? 0,
  );
  const backPath =
    reportOriginPath(useLocation().state, reportPath) ?? reportPath;
  const invalidId = advisingId === null || meetingId === null;
  const [reload, setReload] = useState(0);
  const meeting = useLoad(
    () =>
      invalidId
        ? Promise.resolve(null)
        : nullOnNotFound(getReportMeeting(advisingId, meetingId)),
    invalidId ? null : `${advisingId}|${meetingId}|${reload}`,
  );

  return (
    <ProfileView
      backPath={backPath}
      backLabel="Voltar para o relatório"
      notFoundTitle="Reunião não encontrada"
      notFoundMessage="Esta reunião não existe ou não faz parte deste relatório. Volte para o relatório da orientação."
      genericTitle="Reunião"
      skeletonTestId="meeting-skeleton"
      invalidId={invalidId}
      profile={meeting}
      onRetry={() => setReload((current) => current + 1)}
      // O dia do início, como o servidor o devolve no horário da instituição: o mesmo do cartão.
      title={(data) =>
        `Reunião de ${formatDeadlineShort(data.scheduledAt.slice(0, 10))}`
      }
    >
      {(data) => (
        <Stack spacing={1.5}>
          <MeetingDetails
            item={data}
            userId={user?.id ?? 0}
            emptyNotes="Sem apontamentos registrados."
          />
        </Stack>
      )}
    </ProfileView>
  );
}
