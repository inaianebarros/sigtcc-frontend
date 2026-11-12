import { useCalendarController } from '@fullcalendar/react';
import {
  Alert,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useDialogSlot } from '../hooks/useDialogSlot';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { CalendarToolbar } from '../meetings/calendar/CalendarToolbar';
import { MeetingCalendar } from '../meetings/calendar/MeetingCalendar';
import type { CalendarPeriod } from '../meetings/calendar/MeetingCalendar';
import { capitalize } from '../meetings/calendar/periodDates';
import {
  loadViewPreference,
  saveViewPreference,
} from '../meetings/calendar/viewPreference';
import type { CalendarView } from '../meetings/calendar/viewPreference';
import { MeetingActions } from '../meetings/MeetingActions';
import { REASON_ACTIONS } from '../meetings/reasonActions';
import { MeetingReasonDialog } from '../meetings/MeetingReasonDialog';
import { MeetingDetailsDialog } from '../meetings/MeetingDetailsDialog';
import { MeetingRequestDialog } from '../meetings/MeetingRequestDialog';
import { hasActiveAdvisingOf } from '../navigation/advisingState';
import {
  ApiError,
  isStateChangedError,
  messageForStatus,
} from '../services/apiError';
import {
  answerMeeting,
  listMeetingsInPeriod,
} from '../services/meetingService';
import type { MeetingItem } from '../services/meetingService';

const NO_MEETINGS: MeetingItem[] = [];

/**
 * As reuniões do aluno e do professor (RF19): o calendário do período exibido, o modal de cada
 * reunião e o diálogo de solicitar (RF17 e RF18). As reuniões vêm da leitura por período, buscada a
 * cada mudança de mês (RNF26).
 */
export function MeetingsPage() {
  const { user, refreshUser } = useSession();
  const { notify } = useFeedback();
  // Sem payload o diálogo solicita uma reunião; com a reunião, a edita (RF21).
  const dialog = useDialogSlot<MeetingItem | undefined>();
  // Recusar e cancelar pedem um motivo: a reunião escolhida fica guardada para o diálogo sair com ela.
  const reasonDialog = useDialogSlot<{
    kind: 'reject' | 'cancel';
    item: MeetingItem;
  }>();
  const detailsDialog = useDialogSlot<MeetingItem>();
  const isTeacher = user?.type === 'teacher';
  const userId = user?.id ?? 0;
  const controller = useCalendarController();
  const [view, setView] = useState<CalendarView>(() =>
    loadViewPreference(userId),
  );
  // O período exibido só se conhece depois que o calendário monta; até lá a carga espera.
  const [period, setPeriod] = useState<CalendarPeriod | null>(null);
  const [reload, setReload] = useState(0);
  // A reunião com um pedido em curso: as ações esperam por ele.
  const [acting, setActing] = useState<number | null>(null);
  // Sem orientação ativa o calendário continua, como histórico, mas não há como solicitar (RN29).
  const canRequest = user !== null && hasActiveAdvisingOf(user);
  const list = useLoad(
    () => listMeetingsInPeriod(period?.from ?? '', period?.to ?? ''),
    period === null ? null : `${period.from}|${period.to}|${reload}`,
  );

  const refresh = () => setReload((current) => current + 1);
  // 404 ou 409: a reunião mudou, expirou ou a orientação encerrou. Mostra a mensagem do servidor e
  // lê de novo o calendário e a sessão, para o menu refletir o fim da orientação.
  const handleStateChanged = (message: string) => {
    notify(message, 'error');
    refresh();
    void refreshUser();
  };
  const reasonSlot = reasonDialog.slot;
  const reasonAction = reasonSlot && REASON_ACTIONS[reasonSlot.payload.kind];

  const accept = async (item: MeetingItem) => {
    if (acting !== null) return;
    setActing(item.id);
    try {
      await answerMeeting(item.id, 'accept');
      detailsDialog.hide();
      notify('Reunião aceita.', 'success');
      refresh();
    } catch (error) {
      if (isStateChangedError(error)) {
        detailsDialog.hide();
        handleStateChanged(error.message);
      } else {
        notify(
          error instanceof ApiError ? error.message : messageForStatus(0),
          'error',
        );
      }
    } finally {
      setActing(null);
    }
  };

  // Editar, recusar e cancelar abrem o próprio diálogo, no lugar do modal da reunião.
  const renderActions = (item: MeetingItem) => (
    <MeetingActions
      item={item}
      busy={acting !== null}
      onAccept={(target) => void accept(target)}
      onReject={(target) => {
        detailsDialog.hide();
        reasonDialog.show({ kind: 'reject', item: target });
      }}
      onEdit={(target) => {
        detailsDialog.hide();
        dialog.show(target);
      }}
      onCancel={(target) => {
        detailsDialog.hide();
        reasonDialog.show({ kind: 'cancel', item: target });
      }}
    />
  );

  const detailsSlot = detailsDialog.slot;
  // Ao recarregar (outro mês, ou depois de uma ação) o calendário mantém as reuniões já lidas até
  // as novas chegarem, em vez de esvaziar a grade.
  const [meetings, setMeetings] = useState(NO_MEETINGS);
  if (list.status === 'ready' && list.data !== meetings) {
    setMeetings(list.data);
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
      >
        <Typography variant="h4" component="h1">
          Reuniões
        </Typography>
        {canRequest && (
          <Button variant="contained" onClick={() => dialog.show()}>
            Solicitar reunião
          </Button>
        )}
      </Stack>
      <CalendarToolbar
        title={capitalize(period?.title ?? '')}
        view={view}
        onToday={() => controller.today()}
        onPrevious={() => controller.prev()}
        onNext={() => controller.next()}
        onView={(next) => {
          setView(next);
          saveViewPreference(userId, next);
        }}
      />
      {list.status === 'loading' && (
        <LinearProgress aria-label="Carregando as reuniões do período" />
      )}
      {list.status === 'error' && (
        <Stack spacing={2}>
          <Alert severity="error">{list.message}</Alert>
          <Button onClick={refresh} sx={{ alignSelf: 'flex-start' }}>
            Tentar novamente
          </Button>
        </Stack>
      )}
      {list.status === 'ready' && list.data.length === 0 && (
        <Alert severity="info">Nenhuma reunião neste período.</Alert>
      )}
      <MeetingCalendar
        controller={controller}
        view={view}
        meetings={meetings}
        onPeriod={setPeriod}
        onOpen={(item) => detailsDialog.show(item)}
      />
      {detailsSlot && (
        <MeetingDetailsDialog
          key={`details-${detailsSlot.openCount}`}
          open={detailsSlot.open}
          item={detailsSlot.payload}
          userId={userId}
          actions={renderActions(detailsSlot.payload)}
          onClose={detailsDialog.hide}
          onExited={detailsDialog.unmount}
        />
      )}
      {reasonSlot && reasonAction && (
        <MeetingReasonDialog
          key={`reason-${reasonSlot.openCount}`}
          open={reasonSlot.open}
          title={reasonAction.title}
          intro={reasonAction.intro}
          noun={reasonAction.noun}
          confirmLabel={reasonAction.confirmLabel}
          sendingLabel={reasonAction.sendingLabel}
          send={(reason) =>
            reasonAction.send(reasonSlot.payload.item.id, reason)
          }
          onSaved={() => {
            reasonDialog.hide();
            notify(reasonAction.successMessage, 'success');
            refresh();
          }}
          onStateChanged={(message) => {
            reasonDialog.hide();
            handleStateChanged(message);
          }}
          onClose={reasonDialog.hide}
          onExited={reasonDialog.unmount}
        />
      )}
      {dialog.slot && (
        <MeetingRequestDialog
          key={`form-${dialog.slot.openCount}`}
          open={dialog.slot.open}
          isTeacher={isTeacher}
          preselectedStudent={null}
          meeting={dialog.slot.payload}
          onSaved={() => {
            dialog.hide();
            notify(
              dialog.slot?.payload
                ? 'Reunião atualizada.'
                : 'Reunião solicitada.',
              'success',
            );
            refresh();
          }}
          onNoChanges={() => {
            dialog.hide();
            notify('Nenhuma alteração para salvar.', 'info');
          }}
          onStateChanged={(message) => {
            dialog.hide();
            handleStateChanged(message);
          }}
          onEnded={() => {
            // O diálogo fica aberto, com o aviso: a sessão e a lista é que se atualizam.
            void refreshUser();
            refresh();
          }}
          onClose={dialog.hide}
          onExited={dialog.unmount}
        />
      )}
    </Stack>
  );
}
