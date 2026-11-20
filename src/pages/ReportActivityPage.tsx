import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { ActivityDetailView } from '../activities/ActivityDetailView';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { reportOriginPath } from '../navigation/origin';
import { advisingReportPath } from '../navigation/paths';
import { positiveIntFrom } from '../navigation/positiveInt';
import { ProfileView } from '../profile/ProfileView';
import { getActivity } from '../services/activityService';
import { nullOnNotFound } from '../services/apiError';

/**
 * Uma atividade de uma orientação encerrada, aberta pelo relatório (RF61): o mesmo conteúdo do
 * detalhe da atividade, só para leitura. Carrega uma vez, porque nada nela muda mais, e o acesso
 * segue o do relatório (RN47): qualquer 404 é "Atividade não encontrada", sem o motivo.
 */
export function ReportActivityPage() {
  const params = useParams();
  const advisingId = positiveIntFrom(params.advisingId);
  const activityId = positiveIntFrom(params.activityId);
  const { user } = useSession();
  const reportPath = advisingReportPath(
    user?.type === 'teacher' ? 'teacher' : 'student',
    advisingId ?? 0,
  );
  const backPath =
    reportOriginPath(useLocation().state, reportPath) ?? reportPath;
  const invalidId = advisingId === null || activityId === null;
  const [reload, setReload] = useState(0);
  const activity = useLoad(
    () =>
      invalidId
        ? Promise.resolve(null)
        : nullOnNotFound(getActivity(activityId, { advisingId })),
    invalidId ? null : `${advisingId}|${activityId}|${reload}`,
  );

  return (
    <ProfileView
      backPath={backPath}
      backLabel="Voltar para o relatório"
      notFoundTitle="Atividade não encontrada"
      notFoundMessage="Esta atividade não existe ou não faz parte deste relatório. Volte para o relatório da orientação."
      genericTitle="Atividade"
      skeletonTestId="activity-skeleton"
      invalidId={invalidId}
      profile={activity}
      onRetry={() => setReload((current) => current + 1)}
      title={(data) => data.title}
    >
      {(data) => (
        <ActivityDetailView
          activity={data}
          currentUserId={user?.id ?? null}
          report={invalidId ? undefined : { advisingId }}
        />
      )}
    </ProfileView>
  );
}
