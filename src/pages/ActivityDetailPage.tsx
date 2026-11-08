import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActivityDetailView } from '../activities/ActivityDetailView';
import { ActivityFormDialog } from '../activities/ActivityFormDialog';
import type { ActivityFormValues } from '../activities/activityForm';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { originPath } from '../navigation/origin';
import type { OriginArea } from '../navigation/origin';
import { paths } from '../navigation/paths';
import { positiveIntFrom } from '../navigation/positiveInt';
import { ProfileView } from '../profile/ProfileView';
import {
  deleteActivity,
  getActivity,
  updateActivity,
} from '../services/activityService';
import type {
  ActivityDetail,
  ActivityInput,
} from '../services/activityService';
import {
  ApiError,
  isStateChangedError,
  messageForStatus,
  nullOnNotFound,
} from '../services/apiError';

/** O que o formulário de edição muda em relação à atividade: só esses campos vão ao servidor. */
function changesOf(
  activity: ActivityDetail,
  values: ActivityFormValues,
): Partial<ActivityInput> {
  const changes: Partial<ActivityInput> = {};
  const title = values.title.trim();
  const description = values.description.trim();
  if (title !== activity.title) changes.title = title;
  if (description !== activity.description) changes.description = description;
  if (values.deadline !== activity.deadline) changes.deadline = values.deadline;
  return changes;
}

/** O detalhe de uma atividade (RF30): o aluno lê, e o professor orientador também edita e exclui. */
export function ActivityDetailPage() {
  const { activityId } = useParams();
  const { user, refreshUser } = useSession();
  const { notify } = useFeedback();
  const navigate = useNavigate();
  const isTeacher = user?.type === 'teacher';
  const area: OriginArea = isTeacher ? 'professor' : 'aluno';
  const listPath = isTeacher
    ? paths.teacherActivities
    : paths.studentActivities;
  // Só a lista de atividades vale como origem: qualquer outra volta à lista do perfil.
  const origin = originPath(useLocation().state, area);
  const backPath = origin?.split('?')[0] === listPath ? origin : listPath;
  const id = positiveIntFrom(activityId);
  const [reload, setReload] = useState(0);
  const activity = useLoad(
    () =>
      id === null ? Promise.resolve(null) : nullOnNotFound(getActivity(id)),
    id === null ? null : `${id}|${reload}`,
  );
  // A última leitura completa: o diálogo de edição parte dela, e ela sobrevive à recarga.
  const [shown, setShown] = useState<ActivityDetail | null>(null);
  if (activity.status === 'ready' && activity.data && activity.data !== shown) {
    setShown(activity.data);
  }
  // `openCount` muda a cada abertura, para o formulário recomeçar dos dados da atividade.
  const [dialog, setDialog] = useState<{
    open: boolean;
    openCount: number;
  } | null>(null);
  const closeDialog = () =>
    setDialog((current) => current && { ...current, open: false });

  const saveEdit = async (values: ActivityFormValues) => {
    if (id === null || shown === null) return;
    const changes = changesOf(shown, values);
    if (Object.keys(changes).length === 0) {
      closeDialog();
      notify('Nenhuma alteração para salvar.', 'info');
      return;
    }
    await updateActivity(id, changes);
    closeDialog();
    notify('Atividade atualizada.', 'success');
    setReload((current) => current + 1);
  };

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const onStateChanged = (error: { status: number; message: string }) => {
    closeDialog();
    if (error.status === 404) {
      // O servidor responde 404 quando a orientação da atividade já não está ativa.
      notify('A orientação foi encerrada.', 'error');
      void refreshUser();
    } else {
      notify(error.message, 'error');
    }
    setReload((current) => current + 1);
  };

  const confirmDelete = async () => {
    if (id === null || deleting) return;
    setDeleting(true);
    try {
      await deleteActivity(id);
      setConfirmingDelete(false);
      notify('Atividade excluída.', 'success');
      // Volta à lista de onde veio, com a página e os filtros de antes.
      navigate(backPath, { replace: true });
    } catch (error) {
      setConfirmingDelete(false);
      if (isStateChangedError(error)) {
        onStateChanged(error);
      } else {
        notify(
          error instanceof ApiError ? error.message : messageForStatus(0),
          'error',
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ProfileView
        backPath={backPath}
        notFoundTitle="Atividade não encontrada"
        genericTitle="Atividade"
        skeletonTestId="activity-skeleton"
        invalidId={id === null}
        profile={activity}
        onRetry={() => setReload((current) => current + 1)}
        title={(data) => data.title}
      >
        {(data) => (
          <ActivityDetailView
            activity={data}
            canManage={isTeacher}
            onEdit={() =>
              setDialog((current) => ({
                open: true,
                openCount: (current?.openCount ?? 0) + 1,
              }))
            }
            onDelete={() => setConfirmingDelete(true)}
          />
        )}
      </ProfileView>
      {dialog && shown && (
        <ActivityFormDialog
          key={dialog.openCount}
          mode="edit"
          open={dialog.open}
          initial={{
            studentId: '',
            title: shown.title,
            description: shown.description,
            deadline: shown.deadline,
          }}
          onSave={saveEdit}
          onStateChanged={onStateChanged}
          onClose={closeDialog}
          onExited={() => setDialog(null)}
        />
      )}
      {shown && (
        <ConfirmDialog
          open={confirmingDelete}
          title="Excluir a atividade?"
          message={`A atividade "${shown.title}" deixará de ser exibida para você e para o aluno. As entregas, os comentários e as revisões são preservados. Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir atividade"
          busy={deleting}
          busyLabel="Excluindo…"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </>
  );
}
