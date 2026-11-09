import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActivityDetailView } from '../activities/ActivityDetailView';
import { ActivityFormDialog } from '../activities/ActivityFormDialog';
import { DeliveryDialog } from '../activities/DeliveryDialog';
import { changesOf } from '../activities/activityForm';
import type { ActivityFormValues } from '../activities/activityForm';
import { useStateChangedNotice } from '../hooks/useStateChangedNotice';
import { useDialogSlot } from '../hooks/useDialogSlot';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { originPath } from '../navigation/origin';
import type { OriginArea } from '../navigation/origin';
import { paths } from '../navigation/paths';
import { positiveIntFrom } from '../navigation/positiveInt';
import { ProfileView } from '../profile/ProfileView';
import {
  changeActivityStatus,
  deleteActivity,
  getActivity,
  submitDelivery,
  updateActivity,
} from '../services/activityService';
import type {
  ActivityDetail,
  StudentSettableStatus,
} from '../services/activityService';
import {
  isStateChangedError,
  messageOf,
  nullOnNotFound,
} from '../services/apiError';

const DELETE_NOT_FOUND_MESSAGE =
  'A atividade não está mais disponível. A orientação pode ter sido encerrada.';

/** O detalhe de uma atividade (RF30): o aluno lê, e o professor orientador também edita e exclui. */
export function ActivityDetailPage() {
  const { activityId } = useParams();
  const { user } = useSession();
  const { notify } = useFeedback();
  const notifyStateChanged = useStateChangedNotice();
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
  const refresh = () => setReload((current) => current + 1);
  const activity = useLoad(
    () =>
      id === null ? Promise.resolve(null) : nullOnNotFound(getActivity(id)),
    id === null ? null : `${id}|${reload}`,
  );
  // A última leitura completa: o diálogo de edição parte dela, e ela sobrevive à recarga.
  const [lastLoaded, setLastLoaded] = useState<ActivityDetail | null>(null);
  if (
    activity.status === 'ready' &&
    activity.data &&
    activity.data !== lastLoaded
  ) {
    setLastLoaded(activity.data);
  }
  const dialog = useDialogSlot();
  const deliveryDialog = useDialogSlot();

  const saveEdit = async (values: ActivityFormValues) => {
    if (id === null || lastLoaded === null) return;
    const changes = changesOf(lastLoaded, values);
    if (Object.keys(changes).length === 0) {
      dialog.hide();
      notify('Nenhuma alteração para salvar.', 'info');
      return;
    }
    await updateActivity(id, changes);
    dialog.hide();
    notify('Atividade atualizada.', 'success');
    refresh();
  };

  const [changingStatus, setChangingStatus] = useState(false);
  const changeStatus = async (next: StudentSettableStatus) => {
    if (id === null || changingStatus) return;
    setChangingStatus(true);
    try {
      await changeActivityStatus(id, next);
      notify('Status atualizado.', 'success');
      refresh();
    } catch (error) {
      if (isStateChangedError(error)) {
        refreshAfter(error);
      } else {
        notify(messageOf(error), 'error');
      }
    } finally {
      setChangingStatus(false);
    }
  };

  const [confirmingReview, setConfirmingReview] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const confirmReview = async () => {
    if (id === null || sendingReview) return;
    setSendingReview(true);
    try {
      await changeActivityStatus(id, 'in_review');
      setConfirmingReview(false);
      notify('Atividade enviada para revisão.', 'success');
      refresh();
    } catch (error) {
      setConfirmingReview(false);
      if (isStateChangedError(error)) {
        refreshAfter(error);
      } else {
        notify(messageOf(error), 'error');
      }
    } finally {
      setSendingReview(false);
    }
  };

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refreshAfter = (
    error: { status: number; message: string },
    notFoundMessage?: string,
  ) => {
    dialog.hide();
    notifyStateChanged(error, notFoundMessage);
    refresh();
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
        // Um 404 aqui também pode ser uma atividade que já foi removida.
        refreshAfter(error, DELETE_NOT_FOUND_MESSAGE);
      } else {
        notify(messageOf(error), 'error');
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
        onRetry={refresh}
        title={(data) => data.title}
      >
        {(data) => (
          <ActivityDetailView
            activity={data}
            student={
              isTeacher
                ? undefined
                : {
                    statusBusy: changingStatus,
                    onChangeStatus: (next) => void changeStatus(next),
                    onDeliver: () => deliveryDialog.show(),
                    onSendForReview: () => setConfirmingReview(true),
                  }
            }
            canManage={isTeacher}
            onEdit={() => dialog.show()}
            onDelete={() => setConfirmingDelete(true)}
          />
        )}
      </ProfileView>
      {dialog.slot && lastLoaded && (
        <ActivityFormDialog
          key={dialog.slot.openCount}
          mode="edit"
          open={dialog.slot.open}
          initial={{
            studentId: '',
            title: lastLoaded.title,
            description: lastLoaded.description,
            deadline: lastLoaded.deadline,
          }}
          onSave={saveEdit}
          onStateChanged={refreshAfter}
          onClose={dialog.hide}
          onExited={dialog.unmount}
        />
      )}
      {deliveryDialog.slot && id !== null && (
        <DeliveryDialog
          key={deliveryDialog.slot.openCount}
          open={deliveryDialog.slot.open}
          send={(files, onProgress) => submitDelivery(id, files, onProgress)}
          onSaved={() => {
            deliveryDialog.hide();
            notify('Entrega enviada.', 'success');
            refresh();
          }}
          onStateChanged={(error) => {
            deliveryDialog.hide();
            notifyStateChanged(error);
            refresh();
          }}
          onClose={deliveryDialog.hide}
          onExited={deliveryDialog.unmount}
        />
      )}
      <ConfirmDialog
        open={confirmingReview}
        title="Enviar para revisão?"
        message="Você deixará de poder alterar o status da atividade até o orientador revisá-la. Se ele recusar, a atividade volta para Pendente e você pode reenviar."
        confirmLabel="Enviar para revisão"
        confirmColor="primary"
        busy={sendingReview}
        busyLabel="Enviando…"
        onCancel={() => setConfirmingReview(false)}
        onConfirm={() => void confirmReview()}
      />
      {lastLoaded && (
        <ConfirmDialog
          open={confirmingDelete}
          title="Excluir a atividade?"
          message={`A atividade "${lastLoaded.title}" deixará de ser exibida para você e para o aluno. As entregas, os comentários e as revisões são preservados. Esta ação não pode ser desfeita.`}
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
