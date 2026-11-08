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
import { useNavigate, useLocation } from 'react-router-dom';
import { ActivitiesTable, ActivityCards } from '../activities/ActivitiesTable';
import { ActivityFormDialog } from '../activities/ActivityFormDialog';
import { ActivityFiltersBar } from '../activities/ActivityFiltersBar';
import type { ActivityFormValues } from '../activities/activityForm';
import { useActivityFilters } from '../activities/useActivityFilters';
import { useStateChangedNotice } from '../hooks/useStateChangedNotice';
import { PagePagination } from '../components/PagePagination';
import { useDialogSlot } from '../hooks/useDialogSlot';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useSession } from '../hooks/useSession';
import { useReturnToLastPage, useUrlPage } from '../hooks/useUrlPage';
import { OriginLink } from '../navigation/OriginLink';
import { originState } from '../navigation/origin';
import { activityPath } from '../navigation/paths';
import {
  ACTIVITIES_PAGE_SIZE,
  createActivity,
  listActivities,
} from '../services/activityService';

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'atividade encontrada' : 'atividades encontradas'}`;
}

export function ActivitiesPage() {
  const { user } = useSession();
  const { notify } = useFeedback();
  const notifyStateChanged = useStateChangedNotice();
  const navigate = useNavigate();
  const location = useLocation();
  const isTeacher = user?.type === 'teacher';
  const userType = isTeacher ? 'teacher' : 'student';
  const filters = useActivityFilters(isTeacher);
  const [page, setPage] = useUrlPage();
  const [reload, setReload] = useState(0);
  const listTop = useRef<HTMLDivElement>(null);
  const isNarrow = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down('md'),
  );
  const list = useLoad(
    () =>
      listActivities({
        page,
        status: filters.status,
        overdueOnly: filters.overdueOnly,
        studentId: filters.studentId,
      }),
    `${page}|${filters.status}|${filters.overdueOnly}|${filters.studentId}|${reload}`,
  );
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    ACTIVITIES_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);

  // O nome do aluno do chip vem das atividades carregadas; fica guardado para o chip não piscar
  // enquanto a lista recarrega.
  const [studentNames, setStudentNames] = useState<Record<number, string>>({});
  if (list.status === 'ready') {
    for (const item of list.data.items) {
      if (studentNames[item.student.id] !== item.student.fullName) {
        setStudentNames((current) => ({
          ...current,
          [item.student.id]: item.student.fullName,
        }));
      }
    }
  }
  const studentName =
    filters.studentId === null
      ? null
      : (studentNames[filters.studentId] ?? 'Aluno selecionado');

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

  const openActivity = (item: { id: number }) =>
    navigate(activityPath(userType, item.id), {
      state: originState(location),
    });

  const renderTitle = (item: { id: number; title: string }) => (
    <OriginLink to={activityPath(userType, item.id)}>{item.title}</OriginLink>
  );

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
      <ActivityFiltersBar
        status={filters.status}
        overdueOnly={filters.overdueOnly}
        studentName={studentName}
        onStatus={filters.setStatus}
        onOverdueOnly={filters.setOverdueOnly}
        onClearStudent={filters.clearStudent}
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
          <>
            {isNarrow ? (
              <ActivityCards
                items={list.data.items}
                showStudent={isTeacher}
                renderTitle={renderTitle}
                onOpen={openActivity}
              />
            ) : (
              <ActivitiesTable
                items={list.data.items}
                showStudent={isTeacher}
                renderTitle={renderTitle}
                onOpen={openActivity}
              />
            )}
          </>
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
          preselectedStudent={
            filters.studentId === null
              ? null
              : { id: filters.studentId, name: studentName ?? '' }
          }
          onSave={saveActivity}
          onStateChanged={onStateChanged}
          onClose={dialog.hide}
          onExited={dialog.unmount}
        />
      )}
    </Stack>
  );
}
