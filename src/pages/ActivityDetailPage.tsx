import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { ActivityDetailView } from '../activities/ActivityDetailView';
import { ActivityFormDialog } from '../activities/ActivityFormDialog';
import { DeliveryDialog } from '../activities/DeliveryDialog';
import { RefuseReviewDialog } from '../activities/RefuseReviewDialog';
import { changesOf } from '../activities/activityForm';
import {
  ACTIVITY_GONE_MESSAGE,
  noticeForActivityDialog,
} from '../activities/activityFreshness';
import type {
  ActivityDialogAction,
  ActivityNotice,
} from '../activities/activityFreshness';
import { ChangedNotice } from '../components/ChangedNotice';
import { STATUS_LABELS } from '../activities/activityStatus';
import type { ActivityFormValues } from '../activities/activityForm';
import { useStateChangedNotice } from '../hooks/useStateChangedNotice';
import { useDialogSlot } from '../hooks/useDialogSlot';
import { useFeedback } from '../hooks/useFeedback';
import { useRefreshedLoad } from '../hooks/useRefreshedLoad';
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
  acceptActivity,
  refuseActivity,
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

/**
 * O detalhe de uma atividade (RF30): o aluno lê, e o professor orientador também edita e exclui.
 * A atividade é relida a cada 30 s com a aba visível (ADR frontend 0006): o resumo e as ações
 * acompanham o que a outra parte fez, os diálogos abertos ficam abertos com o que foi digitado e
 * avisam o que mudou, e a atividade que sumiu mostra "Atividade não encontrada".
 */
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
  const { state: activity, retry: refresh } = useRefreshedLoad(
    () =>
      id === null ? Promise.resolve(null) : nullOnNotFound(getActivity(id)),
    id,
  );
  // A última leitura completa, que sobrevive à recarga: a edição grava só o que mudou em relação a
  // ela, e a confirmação de excluir cita o título dela.
  const [lastLoaded, setLastLoaded] = useState<ActivityDetail | null>(null);
  if (
    activity.status === 'ready' &&
    activity.data &&
    activity.data !== lastLoaded
  ) {
    setLastLoaded(activity.data);
  }
  // O comentário ainda não enviado vive aqui, e não na seção: a recarga do detalhe a desmonta
  // (esqueleto), e o texto digitado não pode se perder (RNF28).
  const [commentText, setCommentText] = useState('');
  const unsavedComment = useUnsavedChangesGuard(commentText.trim() !== '');
  const dialog = useDialogSlot();
  const deliveryDialog = useDialogSlot();
  const refuseDialog = useDialogSlot();
  // A atividade como estava quando o diálogo aberto abriu (só um abre por vez), comparada com a
  // última leitura para avisar o que mudou. `null` na leitura é a atividade que sumiu (404).
  const [openedAs, setOpenedAs] = useState<ActivityDetail | null>(null);
  const latest = activity.status === 'ready' ? activity.data : undefined;
  const openWith = (data: ActivityDetail, show: () => void) => {
    setOpenedAs(data);
    show();
  };
  const noticeFor = (
    action: ActivityDialogAction,
    open: boolean,
  ): ActivityNotice | null =>
    open && openedAs ? noticeForActivityDialog(action, openedAs, latest) : null;
  const noticeProps = (action: ActivityDialogAction, open: boolean) => {
    const found = noticeFor(action, open);
    return {
      notice: <ChangedNotice message={found?.message ?? null} />,
      actionBlocked: found?.blocksAction ?? false,
    };
  };

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
      notify(`Situação atualizada para ${STATUS_LABELS[next]}.`, 'success');
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

  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const confirmAccept = async () => {
    if (id === null || accepting) return;
    setAccepting(true);
    try {
      await acceptActivity(id);
      setConfirmingAccept(false);
      notify('Atividade concluída', 'success');
      refresh();
    } catch (error) {
      setConfirmingAccept(false);
      if (isStateChangedError(error)) {
        refreshAfter(error);
      } else {
        notify(messageOf(error), 'error');
      }
    } finally {
      setAccepting(false);
    }
  };

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refreshAfter = (
    error: { status: number; message: string },
    notFoundMessage?: string,
  ) => {
    dialog.hide();
    refuseDialog.hide();
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
        refreshAfter(error, ACTIVITY_GONE_MESSAGE);
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
        backLabel="Voltar para as atividades"
        notFoundTitle="Atividade não encontrada"
        notFoundMessage="Esta atividade não existe ou não está mais disponível para você. Volte para a lista de atividades."
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
                    onDeliver: () =>
                      openWith(data, () => deliveryDialog.show()),
                    onSendForReview: () =>
                      openWith(data, () => setConfirmingReview(true)),
                  }
            }
            review={
              isTeacher
                ? {
                    onAccept: () =>
                      openWith(data, () => setConfirmingAccept(true)),
                    onRefuse: () => openWith(data, () => refuseDialog.show()),
                  }
                : undefined
            }
            comments={{
              currentUserId: user?.id ?? null,
              text: commentText,
              onTextChange: setCommentText,
            }}
            canManage={isTeacher}
            onEdit={() => openWith(data, () => dialog.show())}
            onDelete={() => openWith(data, () => setConfirmingDelete(true))}
          />
        )}
      </ProfileView>
      {dialog.slot && openedAs && (
        <ActivityFormDialog
          key={dialog.slot.openCount}
          mode="edit"
          open={dialog.slot.open}
          // O formulário parte da atividade como estava ao abrir e guarda o que foi digitado; a
          // gravação compara com a última leitura e envia só o que mudou.
          initial={{
            studentId: '',
            title: openedAs.title,
            description: openedAs.description,
            deadline: openedAs.deadline,
          }}
          {...noticeProps('edit', dialog.slot.open)}
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
          {...noticeProps('deliver', deliveryDialog.slot.open)}
          send={(files, onProgress) => submitDelivery(id, files, onProgress)}
          onSaved={() => {
            deliveryDialog.hide();
            notify(
              'Arquivos entregues. Quando terminar, envie a atividade para revisão.',
              'success',
            );
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
      <UnsavedChangesDialog blocker={unsavedComment} />
      {refuseDialog.slot && id !== null && (
        <RefuseReviewDialog
          key={refuseDialog.slot.openCount}
          open={refuseDialog.slot.open}
          {...noticeProps('refuse', refuseDialog.slot.open)}
          send={(justification, files, onProgress) =>
            refuseActivity(id, justification, files, onProgress)
          }
          onSaved={() => {
            refuseDialog.hide();
            notify('Atividade devolvida ao aluno', 'success');
            refresh();
          }}
          onStateChanged={refreshAfter}
          onClose={refuseDialog.hide}
          onExited={refuseDialog.unmount}
        />
      )}
      <ConfirmDialog
        open={confirmingAccept}
        title="Aceitar a atividade?"
        message="Ao aceitar, a atividade é concluída de forma definitiva. Depois disso, ela não poderá mais ser editada, excluída nem receber comentários. Esta ação não pode ser desfeita."
        confirmLabel="Aceitar atividade"
        confirmColor="primary"
        {...noticeProps('accept', confirmingAccept)}
        busy={accepting}
        busyLabel="Aceitando…"
        onCancel={() => setConfirmingAccept(false)}
        onConfirm={() => void confirmAccept()}
      />
      <ConfirmDialog
        open={confirmingReview}
        title="Enviar para revisão?"
        message="Enquanto o orientador revisa, você não poderá entregar arquivos nem mudar a situação da atividade. Se a revisão for recusada, a atividade volta para Pendente e você poderá entregar de novo."
        confirmLabel="Enviar para revisão"
        confirmColor="primary"
        {...noticeProps('sendForReview', confirmingReview)}
        busy={sendingReview}
        busyLabel="Enviando…"
        onCancel={() => setConfirmingReview(false)}
        onConfirm={() => void confirmReview()}
      />
      {lastLoaded && (
        <ConfirmDialog
          open={confirmingDelete}
          title="Excluir a atividade?"
          message={`A atividade "${lastLoaded.title}" deixará de aparecer para você e para o aluno, junto com as entregas e os comentários dela. Não será possível recuperá-la.`}
          confirmLabel="Excluir atividade"
          {...noticeProps('delete', confirmingDelete)}
          busy={deleting}
          busyLabel="Excluindo…"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </>
  );
}
