import { Alert, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ActivityCards } from '../activities/ActivityCards';
import { ActivityFormDialog } from '../activities/ActivityFormDialog';
import { ActivityTotals } from '../activities/ActivityTotals';
import { ActivityFiltersBar } from '../activities/ActivityFiltersBar';
import type { ActivityFormValues } from '../activities/activityForm';
import { useActivityFilters } from '../activities/useActivityFilters';
import type { StudentOption } from '../activities/useStudentFilterOptions';
import { useStateChangedNotice } from '../hooks/useStateChangedNotice';
import { PagePagination } from '../components/PagePagination';
import { useDialogSlot } from '../hooks/useDialogSlot';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useSession } from '../hooks/useSession';
import { useReturnToLastPage, useUrlPage } from '../hooks/useUrlPage';
import {
  ACTIVITIES_PAGE_SIZE,
  createActivity,
  getActivitySummary,
  listActivities,
} from '../services/activityService';
import { getLinkedStudentProfile } from '../services/linkedStudentService';

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'atividade encontrada' : 'atividades encontradas'}`;
}

export function ActivitiesPage() {
  const { user } = useSession();
  const { notify } = useFeedback();
  const notifyStateChanged = useStateChangedNotice();
  const isTeacher = user?.type === 'teacher';
  const userType = isTeacher ? 'teacher' : 'student';
  const filters = useActivityFilters(isTeacher);
  const [page, setPage] = useUrlPage();
  const [reload, setReload] = useState(0);
  const [summaryReload, setSummaryReload] = useState(0);
  const listTop = useRef<HTMLDivElement>(null);
  const list = useLoad(
    () =>
      listActivities({
        page,
        status: filters.status,
        overdueOnly: filters.overdueOnly,
        studentId: filters.studentId,
        search: filters.search,
      }),
    `${page}|${filters.status}|${filters.overdueOnly}|${filters.studentId}|${filters.search}|${reload}`,
  );
  // Os totais não dependem de filtro nem de página: só se relêem quando uma atividade muda
  // (criar, ou um conflito de estado) ou quando o usuário pede de novo.
  const summary = useLoad(getActivitySummary, `${reload}|${summaryReload}`);
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    ACTIVITIES_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);

  // O aluno do filtro: o que o professor escolheu na lista já traz o nome; um id que veio da URL
  // (de outra tela) tem o nome lido do perfil do orientando. Um id que não é de um orientando do
  // professor é ignorado, e o parâmetro sai da URL.
  const [chosen, setChosen] = useState<StudentOption | null>(null);
  const studentId = filters.studentId;
  const profile = useLoad(
    () => getLinkedStudentProfile(studentId!),
    studentId !== null && chosen?.id !== studentId ? studentId : null,
  );
  const dropInvalidStudent = useEffectEvent(() => filters.setStudent(null));
  useEffect(() => {
    if (
      filters.invalidStudentParam ||
      (profile.status === 'ready' && profile.data === null)
    ) {
      dropInvalidStudent();
    }
  }, [profile, filters.invalidStudentParam]);
  const student: StudentOption | null =
    studentId === null
      ? null
      : {
          id: studentId,
          name:
            chosen?.id === studentId
              ? chosen.name
              : profile.status === 'ready' && profile.data
                ? profile.data.fullName
                : 'Aluno selecionado',
        };

  const dialog = useDialogSlot();

  const saveActivity = async (values: ActivityFormValues) => {
    await createActivity(Number(values.studentId), {
      title: values.title.trim(),
      description: values.description.trim(),
      deadline: values.deadline,
    });
    dialog.hide();
    notify('Atividade criada.', 'success');
    setReload((current) => current + 1);
  };

  const onStateChanged = (error: { status: number; message: string }) => {
    dialog.hide();
    notifyStateChanged(error);
    setReload((current) => current + 1);
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
      >
        <Typography variant="h4" component="h1">
          Atividades
        </Typography>
        {isTeacher && (
          <Button variant="contained" onClick={() => dialog.show()}>
            Nova atividade
          </Button>
        )}
      </Stack>
      <ActivityTotals
        summary={summary}
        onRetry={() => setSummaryReload((current) => current + 1)}
      />
      <ActivityFiltersBar
        status={filters.status}
        overdueOnly={filters.overdueOnly}
        search={filters.search}
        student={student}
        canFilterByStudent={isTeacher}
        onStatus={filters.setStatus}
        onOverdueOnly={filters.setOverdueOnly}
        onSearch={filters.setSearch}
        onStudent={(next) => {
          setChosen(next);
          filters.setStudent(next?.id ?? null);
        }}
      />
      <Typography role="status" aria-live="polite" color="text.secondary">
        {list.status === 'ready' && list.data.count > 0
          ? foundText(list.data.count)
          : ''}
      </Typography>
      <div ref={listTop}>
        {list.status === 'loading' && (
          <Stack spacing={2} data-testid="activities-skeleton" aria-hidden>
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
              ? 'Nenhuma atividade encontrada com esses filtros'
              : isTeacher
                ? 'Você ainda não cadastrou atividades. Use Nova atividade para criar a primeira.'
                : 'Você ainda não possui atividades cadastradas'}
          </Alert>
        )}
        {list.status === 'ready' && list.data.items.length > 0 && (
          <ActivityCards
            items={list.data.items}
            showStudent={isTeacher}
            userType={userType}
          />
        )}
      </div>
      <PagePagination
        ariaLabel="Paginação das atividades"
        knownCount={knownCount}
        pageSize={ACTIVITIES_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={(next) => {
          setPage(next);
          listTop.current?.scrollIntoView?.({ block: 'start' });
        }}
      />
      {dialog.slot && (
        <ActivityFormDialog
          key={dialog.slot.openCount}
          mode="create"
          open={dialog.slot.open}
          initial={{
            studentId:
              filters.studentId === null ? '' : String(filters.studentId),
            title: '',
            description: '',
            deadline: '',
          }}
          preselectedStudent={student}
          onSave={saveActivity}
          onStateChanged={onStateChanged}
          onClose={dialog.hide}
          onExited={dialog.unmount}
        />
      )}
    </Stack>
  );
}
