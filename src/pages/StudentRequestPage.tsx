import {
  Alert,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Link,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { StudentRequestCard } from '../advisingRequests/StudentRequestCard';
import { blockedMessage } from '../advisors/blockedMessages';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { PagePagination } from '../components/PagePagination';
import { UrlSearchField } from '../components/UrlSearchField';
import { useLastReady } from '../hooks/useLastReady';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useSession } from '../hooks/useSession';
import {
  PAGE_PARAM,
  useReturnToLastPage,
  useUrlPage,
} from '../hooks/useUrlPage';
import { paths } from '../navigation/paths';
import {
  MY_REQUESTS_PAGE_SIZE,
  getRequestStatus,
  listMyRequests,
} from '../services/advisorService';
import type {
  AdvisingRequestStatus,
  RequestStatus,
} from '../services/advisorService';

const SEARCH_PARAM = 'busca';
const FILTER_PARAM = 'situacao';

type RequestFilter = 'all' | AdvisingRequestStatus;

const FILTERS: readonly {
  value: RequestFilter;
  label: string;
  empty: string;
}[] = [
  { value: 'all', label: 'Todas', empty: '' },
  {
    value: 'pending',
    label: 'Pendentes',
    empty: 'Nenhuma solicitação pendente.',
  },
  { value: 'accepted', label: 'Aceitas', empty: 'Nenhuma solicitação aceita.' },
  {
    value: 'rejected',
    label: 'Recusadas',
    empty: 'Nenhuma solicitação recusada.',
  },
  {
    value: 'unanswered',
    label: 'Não respondidas',
    empty: 'Nenhuma solicitação não respondida.',
  },
];

/** Só uma das cinco situações vale; qualquer outra coisa na URL é "Todas", o padrão. */
function filterFrom(value: string | null): RequestFilter {
  return FILTERS.find((item) => item.value === value)?.value ?? 'all';
}

function countText(count: number, searching: boolean): string {
  const noun = count === 1 ? 'solicitação' : 'solicitações';
  return `${count} ${noun}${searching ? (count === 1 ? ' encontrada' : ' encontradas') : ''}`;
}

function SearchLink() {
  return (
    <Link component={RouterLink} to={paths.studentAdvisors}>
      Buscar orientadores
    </Link>
  );
}

/** Se o aluno pode solicitar de novo e, quando não pode, o motivo (RN04, RN05). */
function Eligibility({ status }: { status: RequestStatus }) {
  return status.canRequest ? (
    <SearchLink />
  ) : (
    <Alert severity="info">{blockedMessage(status.blockedReason)}</Alert>
  );
}

/** As solicitações de orientação do aluno, com busca pelo professor e paginação (RF16). */
export function StudentRequestPage() {
  const { refreshUser } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = (searchParams.get(SEARCH_PARAM) ?? '').trim();
  const filter = filterFrom(searchParams.get(FILTER_PARAM));
  const [page, setPage] = useUrlPage();
  const [reload, setReload] = useState(0);
  const listTop = useRef<HTMLDivElement>(null);
  const status = useLoad(getRequestStatus, `status-${reload}`);
  const list = useLoad(
    () => listMyRequests(page, search, filter === 'all' ? undefined : filter),
    `${page}|${search}|${filter}|${reload}`,
  );
  // O que já foi lido fica na tela enquanto a releitura acontece: sem esqueleto piscando.
  const shown = useLastReady(list);
  const shownStatus = useLastReady(status);
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    MY_REQUESTS_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);
  const refreshed = useRef(false);
  const lastReload = useRef(0);

  // Sem polling: relê ao voltar para a aba, que é quando o professor pode ter respondido. O foco
  // da janela e a visibilidade da aba costumam chegar juntos, então valem como uma releitura só.
  useEffect(() => {
    const reloadOnReturn = () => {
      const now = Date.now();
      if (now - lastReload.current < 1000) return;
      lastReload.current = now;
      setReload((current) => current + 1);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') reloadOnReturn();
    };
    window.addEventListener('focus', reloadOnReturn);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', reloadOnReturn);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // O que importa para o menu é a orientação ativa: uma solicitação aceita cuja orientação já
  // foi encerrada não habilita nada. Um pedido de relê que falhou é tentado de novo na visita.
  const hasAdvising = shownStatus !== null && shownStatus.advising !== null;
  useEffect(() => {
    if (!hasAdvising || refreshed.current) return;
    refreshed.current = true;
    void refreshUser();
  }, [hasAdvising, refreshUser]);

  const changeSearch = (next: string) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      if (next === '') params.delete(SEARCH_PARAM);
      else params.set(SEARCH_PARAM, next);
      return params;
    });
  const chooseFilter = (next: RequestFilter) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      if (next === 'all') params.delete(FILTER_PARAM);
      else params.set(FILTER_PARAM, next);
      return params;
    });
  const retry = () => setReload((current) => current + 1);
  const searching = search !== '';
  // Sem nenhuma solicitação o próprio aviso já traz o link para a busca: não se repete acima.
  const emptyList =
    shown !== null && shown.count === 0 && !searching && filter === 'all';

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4" component="h1">
          Minhas solicitações
        </Typography>
      </div>
      <FormControl component="fieldset">
        <FormLabel component="legend">Situação</FormLabel>
        <RadioGroup
          row
          value={filter}
          onChange={(event) => {
            const chosen = FILTERS.find(
              (item) => item.value === event.target.value,
            );
            if (chosen) chooseFilter(chosen.value);
          }}
        >
          {FILTERS.map((item) => (
            <FormControlLabel
              key={item.value}
              value={item.value}
              control={<Radio />}
              label={item.label}
            />
          ))}
        </RadioGroup>
      </FormControl>
      <UrlSearchField
        label="Buscar professor"
        placeholder="Digite o nome do professor..."
        value={search}
        onSearch={changeSearch}
      />
      {shownStatus !== null && !(emptyList && shownStatus.canRequest) && (
        <Eligibility status={shownStatus} />
      )}
      {shownStatus === null && status.status === 'error' && (
        <Alert
          severity="warning"
          action={<Button onClick={retry}>Atualizar</Button>}
        >
          Não foi possível verificar se você pode solicitar orientação agora.
        </Alert>
      )}
      {/* Só para leitor de tela: uma frase curta numa região própria, pois reler os cartões a cada busca seria ruído. */}
      <VisuallyHidden role="status" aria-live="polite">
        {shown !== null && shown.count > 0
          ? countText(shown.count, searching)
          : shown !== null && searching
            ? 'Nenhuma solicitação encontrada'
            : ''}
      </VisuallyHidden>
      <div ref={listTop}>
        {shown === null && list.status === 'loading' && (
          <Stack spacing={2} data-testid="request-skeleton" aria-hidden>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={150} />
            ))}
          </Stack>
        )}
        {shown === null && list.status === 'error' && (
          <Stack spacing={2}>
            <Alert severity="error">{list.message}</Alert>
            <Button onClick={retry} sx={{ alignSelf: 'flex-start' }}>
              Tentar novamente
            </Button>
          </Stack>
        )}
        {shown !== null && list.status === 'error' && (
          <Alert
            severity="warning"
            action={<Button onClick={retry}>Atualizar</Button>}
            sx={{ mb: 2 }}
          >
            Não foi possível atualizar as solicitações. O que aparece abaixo
            pode estar desatualizado.
          </Alert>
        )}
        {emptyList && (
          <Alert severity="info" action={<SearchLink />}>
            Você ainda não enviou nenhuma solicitação de orientação.
          </Alert>
        )}
        {shown !== null &&
          shown.count === 0 &&
          !searching &&
          filter !== 'all' && (
            <Alert severity="info">
              {FILTERS.find((item) => item.value === filter)?.empty}
            </Alert>
          )}
        {shown !== null && shown.count === 0 && searching && (
          <Stack spacing={2}>
            <Alert severity="info">
              Nenhuma solicitação encontrada para essa busca. Confira o nome do
              professor e tente de novo.
            </Alert>
            <Button
              onClick={() => changeSearch('')}
              sx={{ alignSelf: 'flex-start' }}
            >
              Limpar busca
            </Button>
          </Stack>
        )}
        {shown !== null && shown.items.length > 0 && (
          <Stack spacing={2}>
            {shown.items.map((request) => (
              <StudentRequestCard key={request.id} request={request} />
            ))}
          </Stack>
        )}
      </div>
      <PagePagination
        ariaLabel="Paginação das solicitações"
        knownCount={knownCount}
        pageSize={MY_REQUESTS_PAGE_SIZE}
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
