import { useCalendarController } from '@fullcalendar/react';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDialogSlot } from '../hooks/useDialogSlot';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { CalendarFiltersPanel } from '../meetings/calendar/CalendarFiltersPanel';
import { CalendarToolbar } from '../meetings/calendar/CalendarToolbar';
import { prefillFromClick } from '../meetings/calendar/clickedSlot';
import type { SlotPrefill } from '../meetings/calendar/clickedSlot';
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
  markMeetingHeld,
  MEETING_SITUATIONS,
} from '../services/meetingService';
import type { MeetingItem, MeetingSituation } from '../services/meetingService';

const NO_MEETINGS: MeetingItem[] = [];

const ALL_SITUATIONS: ReadonlySet<MeetingSituation> = new Set(
  MEETING_SITUATIONS,
);

// O texto só para o leitor de tela: a região de estado que anuncia o resultado do filtro.
const SCREEN_READER_ONLY = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

const NO_ADVISING_REASON =
  'Você precisa ter uma orientação ativa para solicitar reuniões.';

/**
 * As reuniões do aluno e do professor (RF19): o calendário do período exibido, o modal de cada
 * reunião e o diálogo de solicitar (RF17 e RF18). As reuniões vêm da leitura por período, buscada a
 * cada mudança de mês (RNF26).
 */
export function MeetingsPage() {
  const { user, refreshUser } = useSession();
  const { notify } = useFeedback();
  // Sem payload o diálogo solicita uma reunião; com a reunião, a edita (RF21).
  const dialog = useDialogSlot<
    { meeting?: MeetingItem; prefill?: SlotPrefill } | undefined
  >();
  // Recusar e cancelar pedem um motivo: a reunião escolhida fica guardada para o diálogo sair com ela.
  const reasonDialog = useDialogSlot<{
    kind: 'reject' | 'cancel';
    item: MeetingItem;
  }>();
  const detailsDialog = useDialogSlot<MeetingItem>();
  // Marcar como realizada é irreversível e pede confirmação explícita (RNF21, RN43).
  const heldDialog = useDialogSlot<MeetingItem>();
  const [markingHeld, setMarkingHeld] = useState(false);
  // A guarda do envio duplicado é um ref: o estado só muda na renderização seguinte, e dois cliques
  // no mesmo instante passariam por ele.
  const markingHeldNow = useRef(false);
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
  // Os filtros do painel (RF59): todos ligados ao abrir e nada é guardado (RN46). Os orientandos
  // são guardados como os desmarcados, para um orientando novo já aparecer marcado.
  const [situations, setSituations] =
    useState<ReadonlySet<MeetingSituation>>(ALL_SITUATIONS);
  const [hiddenStudentIds, setHiddenStudentIds] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const allSituations = situations.size === MEETING_SITUATIONS.length;
  const filtersActive = !allSituations || hiddenStudentIds.size > 0;
  const noSituation = situations.size === 0;
  // Na ordem fixa das situações, para a mesma seleção dar sempre a mesma chave de leitura.
  const situationParam = allSituations
    ? []
    : MEETING_SITUATIONS.filter((situation) => situations.has(situation));
  const hiddenParam = [...hiddenStudentIds].sort((a, b) => a - b);
  const list = useLoad(
    () =>
      listMeetingsInPeriod(period?.from ?? '', period?.to ?? '', {
        situations: situationParam,
        hiddenStudentIds: hiddenParam,
      }),
    // Sem nenhuma situação ligada não há o que ler: o servidor entenderia "todas".
    period === null || noSituation
      ? null
      : `${period.from}|${period.to}|${situationParam.join(',')}|${hiddenParam.join(',')}|${reload}`,
  );
  const chooseSituation = (situation: MeetingSituation, on: boolean) =>
    setSituations((current) => {
      const next = new Set(current);
      if (on) next.add(situation);
      else next.delete(situation);
      return next;
    });
  const chooseStudent = (id: number, on: boolean) =>
    setHiddenStudentIds((current) => {
      const next = new Set(current);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearFilters = () => {
    setSituations(ALL_SITUATIONS);
    setHiddenStudentIds(new Set());
  };

  // Clicar num dia ou numa faixa de horário futura abre a solicitação já preenchida (RF60); o clique
  // em data ou horário passado não faz nada.
  const openFromClick = (dateStr: string) => {
    const prefill = prefillFromClick(dateStr);
    if (prefill) dialog.show({ prefill });
  };
  const chooseView = (next: CalendarView) => {
    setView(next);
    saveViewPreference(userId, next);
  };
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

  const confirmHeld = async (item: MeetingItem) => {
    if (markingHeldNow.current) return;
    markingHeldNow.current = true;
    setMarkingHeld(true);
    try {
      await markMeetingHeld(item.id);
      heldDialog.hide();
      notify('Reunião marcada como realizada.', 'success');
      refresh();
    } catch (error) {
      if (isStateChangedError(error)) {
        // O horário passou, a reunião mudou ou a orientação encerrou: a mensagem é a do servidor.
        heldDialog.hide();
        handleStateChanged(error.message);
      } else {
        notify(
          error instanceof ApiError ? error.message : messageForStatus(0),
          'error',
        );
      }
    } finally {
      markingHeldNow.current = false;
      setMarkingHeld(false);
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
        dialog.show({ meeting: target });
      }}
      onCancel={(target) => {
        detailsDialog.hide();
        reasonDialog.show({ kind: 'cancel', item: target });
      }}
      onMarkHeld={(target) => {
        detailsDialog.hide();
        heldDialog.show(target);
      }}
    />
  );

  const detailsSlot = detailsDialog.slot;
  const heldSlot = heldDialog.slot;
  // Ao recarregar (outro mês, ou depois de uma ação) o calendário mantém as reuniões já lidas até
  // as novas chegarem, em vez de esvaziar a grade.
  const [meetings, setMeetings] = useState(NO_MEETINGS);
  if (list.status === 'ready' && list.data !== meetings) {
    setMeetings(list.data);
  }
  // Com a leitura falha ou sem nenhuma situação, a grade não mantém reuniões que não correspondem
  // aos filtros marcados.
  const shownMeetings =
    noSituation || list.status === 'error' ? NO_MEETINGS : meetings;
  const noMeetingsInPeriod =
    noSituation || (list.status === 'ready' && list.data.length === 0);

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Reuniões
      </Typography>
      <Stack
        spacing={2}
        useFlexGap
        sx={{ flexDirection: { md: 'row' }, alignItems: { md: 'flex-start' } }}
      >
        <CalendarFiltersPanel
          isTeacher={isTeacher}
          situations={situations}
          onSituation={chooseSituation}
          hiddenStudentIds={hiddenStudentIds}
          onStudent={chooseStudent}
          onShowAllStudents={() => setHiddenStudentIds(new Set())}
        />
        <Stack spacing={2} sx={{ flexGrow: 1, minWidth: 0 }}>
          <CalendarToolbar
            title={capitalize(period?.title ?? '')}
            view={view}
            onToday={() => controller.today()}
            onPrevious={() => controller.prev()}
            onNext={() => controller.next()}
            onView={chooseView}
            onRequest={() => dialog.show()}
            requestDisabledReason={
              user === null || canRequest ? null : NO_ADVISING_REASON
            }
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
          <Box role="status" aria-live="polite" sx={SCREEN_READER_ONLY}>
            {list.status === 'ready'
              ? `${list.data.length} ${list.data.length === 1 ? 'reunião' : 'reuniões'} no período.`
              : noSituation
                ? 'Nenhuma situação marcada.'
                : ''}
          </Box>
          {noMeetingsInPeriod && (
            <Alert
              severity="info"
              action={
                filtersActive ? (
                  <Button color="inherit" size="small" onClick={clearFilters}>
                    Ligar todos os filtros
                  </Button>
                ) : undefined
              }
            >
              {filtersActive
                ? 'Nenhuma reunião com esses filtros. Ligue mais filtros para ver outras reuniões.'
                : 'Nenhuma reunião neste período.'}
            </Alert>
          )}
          <MeetingCalendar
            controller={controller}
            view={view}
            meetings={shownMeetings}
            onPeriod={setPeriod}
            onOpen={(item) => detailsDialog.show(item)}
            onMoreLink={() => chooseView('day')}
            onSlotClick={canRequest ? openFromClick : undefined}
          />
        </Stack>
      </Stack>
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
      {heldSlot && (
        <ConfirmDialog
          key={`held-${heldSlot.openCount}`}
          open={heldSlot.open}
          title="Marcar reunião como realizada"
          message={`Esta ação não pode ser desfeita: depois de marcada como realizada, a reunião deixa de poder ser editada ou cancelada. Deseja marcar como realizada a reunião "${heldSlot.payload.description}"?`}
          confirmLabel="Marcar como realizada"
          confirmColor="primary"
          cancelLabel="Voltar"
          busy={markingHeld}
          busyLabel="Marcando…"
          onConfirm={() => void confirmHeld(heldSlot.payload)}
          onCancel={heldDialog.hide}
          onExited={heldDialog.unmount}
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
          meeting={dialog.slot.payload?.meeting}
          prefill={dialog.slot.payload?.prefill}
          onSaved={() => {
            dialog.hide();
            notify(
              dialog.slot?.payload?.meeting
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
