import {
  Alert,
  Button,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { AdviseeCard } from '../advisees/AdviseeCard';
import { PagePagination } from '../components/PagePagination';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { paths } from '../navigation/paths';
import { ADVISEES_PAGE_SIZE, listAdvisees } from '../services/adviseeService';

const PAGE_PARAM = 'pagina';

/** Só um inteiro de 1 em diante vale; qualquer outra coisa na URL é a primeira página. */
function pageFrom(value: string | null): number {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : 1;
}

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'orientando encontrado' : 'orientandos encontrados'}`;
}

export function TeacherAdviseesPage() {
  const [reload, setReload] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const page = pageFrom(searchParams.get(PAGE_PARAM));
  const listTop = useRef<HTMLDivElement>(null);
  const list = useLoad(() => listAdvisees(page), `${page}|${reload}`);

  // A página vive na URL: assim recarregar ou voltar de outra tela a restaura. A primeira
  // página fica sem o parâmetro.
  const goToPage = (next: number, replace = false) => {
    setSearchParams(next === 1 ? {} : { [PAGE_PARAM]: String(next) }, {
      replace,
    });
  };

  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    ADVISEES_PAGE_SIZE,
    page,
  );

  // Uma página além da última volta para a última que existe, sem entrar no histórico. Aqui é
  // um efeito, e não a correção na renderização das outras listas: a página vive na URL, e
  // navegar durante a renderização atualizaria o roteador no meio dela.
  const backToLastPage = useEffectEvent((last: number) => goToPage(last, true));
  useEffect(() => {
    if (fallbackPage !== null && fallbackPage !== page) {
      backToLastPage(fallbackPage);
    }
  }, [fallbackPage, page]);

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Orientandos
      </Typography>
      {/* Uma frase curta numa região própria: reler a lista inteira a cada página seria ruído. */}
      <Typography role="status" aria-live="polite" color="text.secondary">
        {list.status === 'ready' && list.data.count > 0
          ? foundText(list.data.count)
          : ''}
      </Typography>
      <div ref={listTop}>
        {list.status === 'loading' && (
          <Stack spacing={2} data-testid="advisees-skeleton" aria-hidden>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={170} />
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
            Você ainda não tem orientandos ativos.{' '}
            <Link component={RouterLink} to={paths.teacherRequests}>
              Ver as solicitações recebidas
            </Link>
          </Alert>
        )}
        {list.status === 'ready' && list.data.items.length > 0 && (
          <Stack spacing={2}>
            {list.data.items.map((advisee) => (
              <AdviseeCard key={advisee.advisingId} advisee={advisee} />
            ))}
          </Stack>
        )}
      </div>
      <PagePagination
        ariaLabel="Paginação dos orientandos"
        knownCount={knownCount}
        pageSize={ADVISEES_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={(next) => {
          goToPage(next);
          listTop.current?.scrollIntoView?.({ block: 'start' });
        }}
      />
    </Stack>
  );
}
