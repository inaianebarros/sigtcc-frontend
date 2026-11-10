import { Alert, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { EndedAdvisingCard } from '../advisingHistory/EndedAdvisingCard';
import { PagePagination } from '../components/PagePagination';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useSession } from '../hooks/useSession';
import { useReturnToLastPage, useUrlPage } from '../hooks/useUrlPage';
import {
  HISTORY_PAGE_SIZE,
  listAdvisingHistory,
} from '../services/advisingHistoryService';

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'orientação encerrada' : 'orientações encerradas'}`;
}

/** O histórico de orientações encerradas do aluno e do professor (RF49). */
export function AdvisingHistoryPage() {
  const { user } = useSession();
  const isStudent = user?.type === 'student';
  const [page, setPage] = useUrlPage();
  const [reload, setReload] = useState(0);
  const listTop = useRef<HTMLDivElement>(null);
  const list = useLoad(() => listAdvisingHistory(page), `${page}|${reload}`);
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    HISTORY_PAGE_SIZE,
    page,
  );

  useReturnToLastPage(fallbackPage, page, setPage);

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Histórico de orientações
      </Typography>
      {/* Uma frase curta numa região própria: reler a lista inteira a cada página seria ruído. */}
      <Typography role="status" aria-live="polite" color="text.secondary">
        {list.status === 'ready' && list.data.count > 0
          ? foundText(list.data.count)
          : ''}
      </Typography>
      <div ref={listTop}>
        {list.status === 'loading' && (
          <Stack spacing={2} data-testid="history-skeleton" aria-hidden>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={190} />
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
          <Alert severity="info">
            {isStudent
              ? 'Você ainda não tem orientações encerradas. '
              : 'Você ainda não encerrou nenhuma orientação. '}
            Quando uma orientação terminar, ela aparece aqui, com o motivo do
            encerramento e o tema do TCC.
          </Alert>
        )}
        {list.status === 'ready' && list.data.items.length > 0 && (
          <Stack spacing={2}>
            {list.data.items.map((advising) => (
              <EndedAdvisingCard
                key={advising.id}
                advising={advising}
                counterpartRole={isStudent ? 'Professor orientador' : 'Aluno'}
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
