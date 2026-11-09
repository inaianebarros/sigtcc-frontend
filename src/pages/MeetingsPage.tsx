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
import { MeetingFiltersBar } from '../meetings/MeetingFiltersBar';
import { MeetingRequestDialog } from '../meetings/MeetingRequestDialog';
import { MeetingCards, MeetingsTable } from '../meetings/MeetingsTable';
import { useMeetingFilters } from '../meetings/useMeetingFilters';
import { hasActiveAdvisingOf } from '../navigation/advisingState';
import { listMeetings, MEETINGS_PAGE_SIZE } from '../services/meetingService';

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'reunião encontrada' : 'reuniões encontradas'}`;
}

/** As reuniões do aluno e do professor (RF19): a lista, e o diálogo de solicitar (RF17 e RF18). */
export function MeetingsPage() {
  const { user, refreshUser } = useSession();
  const { notify } = useFeedback();
  const dialog = useDialogSlot();
  const isTeacher = user?.type === 'teacher';
  const filters = useMeetingFilters(isTeacher);
  const [page, setPage] = useUrlPage();
  const [reload, setReload] = useState(0);
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
              <MeetingCards items={list.data.items} userId={user?.id ?? 0} />
            ) : (
              <MeetingsTable items={list.data.items} userId={user?.id ?? 0} />
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
      {dialog.slot && (
        <MeetingRequestDialog
          key={dialog.slot.openCount}
          open={dialog.slot.open}
          isTeacher={isTeacher}
          preselectedStudent={student}
          onSaved={() => {
            dialog.hide();
            notify('Reunião solicitada.', 'success');
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
