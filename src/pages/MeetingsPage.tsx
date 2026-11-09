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
  cancelMeeting,
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

  const accept = async (item: MeetingItem) => {
    if (acting !== null) return;
    setActing(item.id);
    try {
      await answerMeeting(item.id, 'accept');
      notify('Reunião aceita.', 'success');
      setReload((current) => current + 1);
    } catch (error) {
      notify(
        error instanceof ApiError ? error.message : messageForStatus(0),
        'error',
      );
      // 404 ou 409: a reunião mudou, expirou ou a orientação encerrou; a lista é lida de novo.
      if (isStateChangedError(error)) setReload((current) => current + 1);
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
      {reasonDialog.slot && (
        <MeetingReasonDialog
          key={reasonDialog.slot.openCount}
          open={reasonDialog.slot.open}
          {...(reasonDialog.slot.payload.kind === 'reject'
            ? {
                title: 'Recusar reunião',
                intro:
                  'Explique à outra parte por que a reunião foi recusada. Depois de recusada, ela não pode ser alterada.',
                noun: 'justificativa' as const,
                confirmLabel: 'Recusar',
                sendingLabel: 'Recusando…',
                send: (reason: string) =>
                  answerMeeting(
                    reasonDialog.slot!.payload.item.id,
                    'reject',
                    reason,
                  ),
              }
            : {
                title: 'Cancelar reunião',
                intro:
                  'Esta ação não pode ser desfeita. Informe o motivo do cancelamento.',
                noun: 'motivo' as const,
                confirmLabel: 'Cancelar reunião',
                sendingLabel: 'Cancelando…',
                send: (reason: string) =>
                  cancelMeeting(reasonDialog.slot!.payload.item.id, reason),
              })}
          onSaved={() => {
            reasonDialog.hide();
            notify(
              reasonDialog.slot?.payload.kind === 'reject'
                ? 'Reunião recusada.'
                : 'Reunião cancelada.',
              'success',
            );
            setReload((current) => current + 1);
          }}
          onStateChanged={(message) => {
            reasonDialog.hide();
            notify(message, 'error');
            setReload((current) => current + 1);
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
            setReload((current) => current + 1);
          }}
          onNoChanges={() => {
            dialog.hide();
            notify('Nenhuma alteração para salvar.', 'info');
          }}
          onStateChanged={(message) => {
            dialog.hide();
            notify(message, 'error');
            setReload((current) => current + 1);
          }}
          onEnded={() => {
            // O diálogo fica aberto, com o aviso: a sessão e a lista é que se atualizam.
            void refreshUser();
            setReload((current) => current + 1);
          }}
          onClose={dialog.hide}
          onExited={dialog.unmount}
        />
      )}
    </Stack>
  );
}
