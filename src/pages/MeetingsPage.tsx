import {
  Alert,
  Button,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { Theme } from '@mui/material';
import { useRef, useState } from 'react';
import { PagePagination } from '../components/PagePagination';
import { useDialogSlot } from '../hooks/useDialogSlot';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useSession } from '../hooks/useSession';
import { useReturnToLastPage, useUrlPage } from '../hooks/useUrlPage';
import { MeetingActions } from '../meetings/MeetingActions';
import { REASON_ACTIONS } from '../meetings/reasonActions';
import { MeetingReasonDialog } from '../meetings/MeetingReasonDialog';
import { MeetingFiltersBar } from '../meetings/MeetingFiltersBar';
import { MeetingRequestDialog } from '../meetings/MeetingRequestDialog';
import { MeetingCards, MeetingsTable } from '../meetings/MeetingsTable';
import { useMeetingFilters } from '../meetings/useMeetingFilters';
import { hasActiveAdvisingOf } from '../navigation/advisingState';
import {
  ApiError,
  isStateChangedError,
  messageForStatus,
} from '../services/apiError';
import {
  answerMeeting,
  listMeetings,
  MEETINGS_PAGE_SIZE,
} from '../services/meetingService';
import type { MeetingItem } from '../services/meetingService';

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'reunião encontrada' : 'reuniões encontradas'}`;
}

/** As reuniões do aluno e do professor (RF19): a lista, e o diálogo de solicitar (RF17 e RF18). */
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
  const isTeacher = user?.type === 'teacher';
  const filters = useMeetingFilters(isTeacher);
  const [page, setPage] = useUrlPage();
  const [reload, setReload] = useState(0);
  // A reunião com um pedido em curso: as ações de todas as linhas esperam por ele.
  const [acting, setActing] = useState<number | null>(null);
  const listTop = useRef<HTMLDivElement>(null);
  const isNarrow = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down('md'),
  );
  // Sem orientação ativa a lista continua, como histórico, mas não há como solicitar (RN29).
  const canRequest = user !== null && hasActiveAdvisingOf(user);
  const list = useLoad(
    () =>
      listMeetings({
        page,
        situation: filters.situation,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        studentId: filters.studentId,
      }),
    // Datas fora de ordem não consultam o servidor: a chave nula deixa a carga parada.
    filters.rangeError === null
      ? `${page}|${filters.situation}|${filters.dateFrom}|${filters.dateTo}|${filters.studentId}|${reload}`
      : null,
  );
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    MEETINGS_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);

  // O nome do aluno do filtro vem das reuniões carregadas; fica guardado para o campo não piscar.
  const [studentNames, setStudentNames] = useState<Record<number, string>>({});
  if (list.status === 'ready') {
    for (const item of list.data.items) {
      if (studentNames[item.counterpart.id] !== item.counterpart.fullName) {
        setStudentNames((current) => ({
          ...current,
          [item.counterpart.id]: item.counterpart.fullName,
        }));
      }
    }
  }
  const student =
    filters.studentId === null
      ? null
      : {
          id: filters.studentId,
          name: studentNames[filters.studentId] ?? 'Aluno selecionado',
        };

  const refresh = () => setReload((current) => current + 1);
  // 404 ou 409: a reunião mudou, expirou ou a orientação encerrou. Mostra a mensagem do servidor e
  // lê de novo a lista e a sessão, para o menu refletir o fim da orientação.
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
      notify('Reunião aceita.', 'success');
      refresh();
    } catch (error) {
      if (isStateChangedError(error)) {
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

  const renderActions = (item: MeetingItem) => (
    <MeetingActions
      item={item}
      busy={acting !== null}
      onAccept={(target) => void accept(target)}
      onReject={(target) => reasonDialog.show({ kind: 'reject', item: target })}
      onEdit={(target) => dialog.show(target)}
      onCancel={(target) => reasonDialog.show({ kind: 'cancel', item: target })}
    />
  );

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
      <MeetingFiltersBar
        situation={filters.situation}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        rangeError={filters.rangeError}
        showStudent={isTeacher}
        student={student}
        onSituation={filters.setSituation}
        onDateFrom={filters.setDateFrom}
        onDateTo={filters.setDateTo}
        onStudent={filters.setStudent}
      />
      <Typography role="status" aria-live="polite" color="text.secondary">
        {list.status === 'ready' && list.data.count > 0
          ? foundText(list.data.count)
          : ''}
      </Typography>
      <div ref={listTop}>
        {list.status === 'loading' && (
          <Stack spacing={2} data-testid="meetings-skeleton" aria-hidden>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={64} />
            ))}
          </Stack>
        )}
        {list.status === 'error' && (
          <Stack spacing={2}>
            <Alert severity="error">{list.message}</Alert>
            <Button
              onClick={() => setReload((current) => current + 1)}
              sx={{ alignSelf: 'flex-start' }}
            >
              Tentar novamente
            </Button>
          </Stack>
        )}
        {list.status === 'ready' && list.data.count === 0 && (
          <Alert
            severity="info"
            action={
              filters.hasFilters ? (
                <Button color="inherit" size="small" onClick={filters.clearAll}>
                  Limpar filtros
                </Button>
              ) : undefined
            }
          >
            {filters.hasFilters
              ? 'Nenhuma reunião encontrada com esses filtros'
              : 'Você ainda não tem reuniões.'}
          </Alert>
        )}
        {list.status === 'ready' && list.data.items.length > 0 && (
          <>
            {isNarrow ? (
              <MeetingCards
                items={list.data.items}
                userId={user?.id ?? 0}
                renderActions={renderActions}
              />
            ) : (
              <MeetingsTable
                items={list.data.items}
                userId={user?.id ?? 0}
                renderActions={renderActions}
              />
            )}
          </>
        )}
      </div>
      <PagePagination
        ariaLabel="Paginação das reuniões"
        knownCount={knownCount}
        pageSize={MEETINGS_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={(next) => {
          setPage(next);
          listTop.current?.scrollIntoView?.({ block: 'start' });
        }}
      />
      {reasonSlot && reasonAction && (
        <MeetingReasonDialog
          key={reasonSlot.openCount}
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
          key={dialog.slot.openCount}
          open={dialog.slot.open}
          isTeacher={isTeacher}
          preselectedStudent={student}
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
