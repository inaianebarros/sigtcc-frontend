import {
  Alert,
  Button,
  FormControlLabel,
  Pagination,
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
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
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

function pageLabel(
  type: string,
  page: number | null,
  selected: boolean,
): string {
  if (type === 'page') {
    return selected ? `Página ${page}, atual` : `Ir para a página ${page}`;
  }
  if (type === 'first') return 'Ir para a primeira página';
  if (type === 'last') return 'Ir para a última página';
  if (type === 'next') return 'Ir para a próxima página';
  return 'Ir para a página anterior';
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
  // A página escolhida vale só para os filtros atuais: se algum mudar, volta à página 1.
  // Um filtro novo entra só nesta chave.
  const filterKey = `${name}|${onlyAvailable}`;
  const [chosen, setChosen] = useState({ filterKey, page: 1 });
  if (chosen.filterKey !== filterKey) setChosen({ filterKey, page: 1 });
  const page = chosen.filterKey === filterKey ? chosen.page : 1;
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
  // O total da última resposta mantém a paginação montada durante o carregamento: se ela
  // sumisse, o botão que a pessoa acabou de usar deixaria de existir e o foco se perderia.
  const [knownCount, setKnownCount] = useState(0);
  if (list.status === 'ready' && list.data.count !== knownCount) {
    setKnownCount(list.data.count);
  }
  const lastPage = Math.max(1, Math.ceil(knownCount / ADVISORS_PAGE_SIZE));
  // Uma página que ficou vazia (a lista encolheu) volta para a última que existe.
  if (
    list.status === 'ready' &&
    list.data.items.length === 0 &&
    list.data.count > 0 &&
    page > 1
  ) {
    setChosen({
      filterKey,
      page: Math.min(page, Math.ceil(list.data.count / ADVISORS_PAGE_SIZE)),
    });
  }

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
      {knownCount > ADVISORS_PAGE_SIZE && (
        <Pagination
          aria-label="Paginação dos orientadores"
          count={lastPage}
          page={Math.min(page, lastPage)}
          getItemAriaLabel={pageLabel}
          onChange={(_, value) => {
            setChosen({ filterKey, page: value });
            listTop.current?.scrollIntoView?.({ block: 'start' });
          }}
          sx={{ alignSelf: 'center' }}
        />
      )}
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
