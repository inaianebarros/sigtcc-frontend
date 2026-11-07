import {
  Alert,
  Button,
  FormControlLabel,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdvisorCard } from '../advisors/AdvisorCard';
import { EligibilityNotice } from '../advisors/EligibilityNotice';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PagePagination } from '../components/PagePagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useFeedback } from '../hooks/useFeedback';
import { useFilteredPage } from '../hooks/useFilteredPage';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { paths } from '../navigation/paths';
import { ApiError, messageForStatus } from '../services/apiError';
import {
  ADVISORS_PAGE_SIZE,
  getRequestEligibility,
  requestAdvising,
  searchAdvisors,
} from '../services/advisorService';
import type { Advisor, AdvisorPage } from '../services/advisorService';

const SEARCH_DEBOUNCE_MS = 400;

function ListSkeleton() {
  return (
    <Stack spacing={2} data-testid="advisors-skeleton" aria-hidden>
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} variant="rounded" height={140} />
      ))}
    </Stack>
  );
}

function foundText(count: number, onlyAvailable: boolean): string {
  const one = count === 1;
  if (onlyAvailable) {
    return `${count} ${one ? 'professor disponível encontrado' : 'professores disponíveis encontrados'}`;
  }
  return `${count} ${one ? 'professor encontrado' : 'professores encontrados'}`;
}

function emptyMessage(name: string, onlyAvailable: boolean): string {
  if (onlyAvailable) {
    return name
      ? `Nenhum professor disponível encontrado para “${name}”.`
      : 'Nenhum professor disponível no momento.';
  }
  return name
    ? `Nenhum professor encontrado para “${name}”.`
    : 'Ainda não há professores cadastrados para o seu curso.';
}

export function AdvisorsPage() {
  // Cada carga tem o seu contador: refazer a elegibilidade não recarrega a lista, e vice-versa.
  const [listReload, setListReload] = useState(0);
  const [statusReload, setStatusReload] = useState(0);
  const [typed, setTyped] = useState('');
  const name = useDebouncedValue(typed, SEARCH_DEBOUNCE_MS).trim();
  // A escolha de ver os indisponíveis não é guardada: cada visita começa pelo padrão.
  const [showAll, setShowAll] = useState(false);
  const onlyAvailable = !showAll;
  // Um filtro novo entra só nesta chave: ao mudar, a lista volta à página 1.
  const filterKey = `${name}|${onlyAvailable}`;
  const [page, setPage] = useFilteredPage(filterKey);
  const switchInput = useRef<HTMLInputElement>(null);
  const listTop = useRef<HTMLDivElement>(null);
  const eligibility = useLoad(getRequestEligibility, `status-${statusReload}`);
  const noticeId = useId();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [asking, setAsking] = useState<Advisor | null>(null);
  // O nome fica guardado: o texto do diálogo não pode mudar durante a animação de saída.
  const [askedName, setAskedName] = useState('');
  const [sending, setSending] = useState(false);
  const canRequest =
    eligibility.status === 'ready' && eligibility.data.canRequest;
  const list = useLoad<AdvisorPage>(
    () => searchAdvisors({ name, page, onlyAvailable }),
    `${filterKey}|${page}|${listReload}`,
  );
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    ADVISORS_PAGE_SIZE,
    page,
  );
  // Uma página que ficou vazia volta para a última que existe.
  if (fallbackPage !== null) setPage(fallbackPage);

  const confirmRequest = async () => {
    if (!asking || sending) return;
    setSending(true);
    try {
      await requestAdvising(asking.id);
      setAsking(null);
      notify(
        'Solicitação enviada. Acompanhe a resposta do professor em “Minha solicitação”.',
        'success',
      );
      navigate(paths.studentRequest);
    } catch (error) {
      setAsking(null);
      notify(
        error instanceof ApiError ? error.message : messageForStatus(0),
        'error',
      );
      // Um 409 quer dizer que a situação mudou: relê a elegibilidade e a lista.
      if (error instanceof ApiError && error.status === 409) {
        setStatusReload((current) => current + 1);
        setListReload((current) => current + 1);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Orientadores
      </Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <TextField
          label="Buscar por nome"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 150 } }}
          sx={{ flexGrow: 1 }}
        />
        <FormControlLabel
          label="Mostrar indisponíveis"
          control={
            <Switch
              checked={showAll}
              onChange={(event) => setShowAll(event.target.checked)}
              slotProps={{ input: { ref: switchInput } }}
            />
          }
        />
      </Stack>
      <EligibilityNotice
        id={noticeId}
        eligibility={eligibility}
        onRetry={() => setStatusReload((current) => current + 1)}
      />
      {/* Uma frase curta numa região própria: reler os 20 cards a cada busca seria ruído. */}
      <Typography role="status" aria-live="polite" color="text.secondary">
        {list.status === 'ready' && list.data.count > 0
          ? foundText(list.data.count, onlyAvailable)
          : ''}
      </Typography>
      <div ref={listTop}>
        {list.status === 'loading' && <ListSkeleton />}
        {list.status === 'error' && (
          <Stack spacing={2}>
            <Alert severity="error">{list.message}</Alert>
            <Button
              onClick={() => setListReload((current) => current + 1)}
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
              onlyAvailable ? (
                <Button
                  onClick={() => {
                    setShowAll(true);
                    // O alerta some ao recarregar: o foco vai para a chave, que anuncia o novo estado.
                    switchInput.current?.focus();
                  }}
                >
                  Ver também os indisponíveis
                </Button>
              ) : undefined
            }
          >
            {emptyMessage(name, onlyAvailable)}
          </Alert>
        )}
        {list.status === 'ready' && list.data.items.length > 0 && (
          <Stack spacing={2}>
            {list.data.items.map((advisor) => (
              <AdvisorCard
                key={advisor.id}
                advisor={advisor}
                canRequest={canRequest}
                blockedNoticeId={
                  eligibility.status === 'loading' ? null : noticeId
                }
                onRequest={(advisor) => {
                  setAskedName(advisor.fullName);
                  setAsking(advisor);
                }}
              />
            ))}
          </Stack>
        )}
      </div>
      <PagePagination
        ariaLabel="Paginação dos orientadores"
        knownCount={knownCount}
        pageSize={ADVISORS_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={(next) => {
          setPage(next);
          listTop.current?.scrollIntoView?.({ block: 'start' });
        }}
      />
      <ConfirmDialog
        open={asking !== null}
        title={`Solicitar orientação ao professor ${askedName}?`}
        message="O professor tem 7 dias para responder. Enquanto a solicitação estiver pendente, você não poderá enviar outra."
        confirmLabel="Solicitar"
        confirmColor="primary"
        busy={sending}
        onCancel={() => setAsking(null)}
        onConfirm={confirmRequest}
      />
    </Stack>
  );
}
