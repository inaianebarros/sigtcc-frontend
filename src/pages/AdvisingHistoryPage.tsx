import { Alert, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EndedAdvisingCard } from '../advisingHistory/EndedAdvisingCard';
import { HistoryTotals } from '../advisingHistory/HistoryTotals';
import { PagePagination } from '../components/PagePagination';
import { UrlSearchField } from '../components/UrlSearchField';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useSession } from '../hooks/useSession';
import {
  advisingReportPath,
  studentAdvisorPath,
  teacherStudentPath,
} from '../navigation/paths';
import {
  PAGE_PARAM,
  useReturnToLastPage,
  useUrlPage,
} from '../hooks/useUrlPage';
import {
  HISTORY_PAGE_SIZE,
  getAdvisingHistorySummary,
  listAdvisingHistory,
} from '../services/advisingHistoryService';

const SEARCH_PARAM = 'busca';

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'orientação encontrada' : 'orientações encontradas'}`;
}

/** O histórico de orientações encerradas do aluno e do professor (RF49). */
export function AdvisingHistoryPage() {
  const { user } = useSession();
  const isStudent = user?.type === 'student';
  const [searchParams, setSearchParams] = useSearchParams();
  const search = (searchParams.get(SEARCH_PARAM) ?? '').trim();
  const [page, setPage] = useUrlPage();
  const [reload, setReload] = useState(0);
  const [summaryReload, setSummaryReload] = useState(0);
  const listTop = useRef<HTMLDivElement>(null);
  const summary = useLoad(
    getAdvisingHistorySummary,
    `summary|${summaryReload}`,
  );
  const list = useLoad(
    () => listAdvisingHistory(page, search),
    `${page}|${search}|${reload}`,
  );
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    HISTORY_PAGE_SIZE,
    page,
  );

  useReturnToLastPage(fallbackPage, page, setPage);

  const changeSearch = (next: string) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      if (next === '') params.delete(SEARCH_PARAM);
      else params.set(SEARCH_PARAM, next);
      return params;
    });

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4" component="h1" gutterBottom>
          Histórico de orientações
        </Typography>
        <Typography color="text.secondary">
          {isStudent
            ? 'Orientações que já terminaram, com o tema, as datas e o relatório de cada uma. Se houver orientação em andamento, ela fica no Início.'
            : 'Orientações que você encerrou, com o tema, as datas e o relatório de cada uma. Quem você orienta agora está em Orientandos.'}
        </Typography>
      </div>
      <HistoryTotals
        summary={summary}
        showActive={!isStudent}
        onRetry={() => setSummaryReload((current) => current + 1)}
      />
      <UrlSearchField
        label="Buscar por nome ou tema do TCC"
        placeholder={
          isStudent
            ? 'Nome do orientador ou tema'
            : 'Nome do orientando ou tema'
        }
        value={search}
        onSearch={changeSearch}
      />
      {/* Uma frase curta numa região própria: reler a lista inteira a cada página seria ruído. */}
      <Typography role="status" aria-live="polite" color="text.secondary">
        {list.status === 'ready' && search !== ''
          ? foundText(list.data.count)
          : ''}
      </Typography>
      <div ref={listTop}>
        {list.status === 'loading' && (
          <Stack spacing={2} data-testid="history-skeleton" aria-hidden>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={210} />
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
        {list.status === 'ready' && list.data.count === 0 && search === '' && (
          <Alert severity="info">
            {isStudent
              ? 'Você ainda não tem orientações encerradas. Quando o professor encerrar uma orientação, ela aparece aqui, com o tema do TCC, as datas e o relatório.'
              : 'Você ainda não encerrou nenhuma orientação. As que você encerrar aparecem aqui, com o tema do TCC, as datas e o relatório.'}
          </Alert>
        )}
        {list.status === 'ready' && list.data.count === 0 && search !== '' && (
          <Stack spacing={2}>
            <Alert severity="info">
              Nenhuma orientação encontrada para essa busca. Confira o nome ou o
              tema e tente de novo.
            </Alert>
            <Button
              onClick={() => changeSearch('')}
              sx={{ alignSelf: 'flex-start' }}
            >
              Limpar busca
            </Button>
          </Stack>
        )}
        {list.status === 'ready' && list.data.items.length > 0 && (
          <Stack spacing={2}>
            {list.data.items.map((advising) => (
              <EndedAdvisingCard
                key={advising.id}
                advising={advising}
                counterpartRole={isStudent ? 'Orientador(a)' : 'Orientando(a)'}
                reportPath={advisingReportPath(
                  isStudent ? 'student' : 'teacher',
                  advising.id,
                )}
                counterpartPath={
                  isStudent
                    ? studentAdvisorPath(advising.counterpart.id)
                    : teacherStudentPath(advising.counterpart.id)
                }
              />
            ))}
          </Stack>
        )}
      </div>
      <PagePagination
        ariaLabel="Paginação do histórico"
        knownCount={knownCount}
        pageSize={HISTORY_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={(next) => {
          setPage(next);
          listTop.current?.scrollIntoView?.({ block: 'start' });
        }}
      />
    </Stack>
  );
}
