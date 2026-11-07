import {
  Alert,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PagePagination } from '../components/PagePagination';
import { useFeedback } from '../hooks/useFeedback';
import { useFilteredPage } from '../hooks/useFilteredPage';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useSession } from '../hooks/useSession';
import { ApiError, messageForStatus } from '../services/apiError';
import {
  REQUESTS_PAGE_SIZE,
  answerRequest,
  listReceivedRequests,
} from '../services/teacherRequestService';
import type {
  AnswerAction,
  ReceivedRequest,
  RequestFilter,
} from '../services/teacherRequestService';
import { RequestItem } from '../teacherRequests/RequestItem';

const FILTERS: readonly {
  value: RequestFilter;
  label: string;
  empty: string;
}[] = [
  {
    value: 'pending',
    label: 'Pendentes',
    empty: 'Nenhuma solicitação pendente.',
  },
  {
    value: 'all',
    label: 'Todas',
    empty: 'Você ainda não recebeu nenhuma solicitação.',
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

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'solicitação encontrada' : 'solicitações encontradas'}`;
}

export function TeacherRequestsPage() {
  const [listReload, setListReload] = useState(0);
  const [filter, setFilter] = useState<RequestFilter>('pending');
  const [page, setPage] = useFilteredPage(filter);
  const listTop = useRef<HTMLDivElement>(null);
  const listKey = `${filter}|${page}|${listReload}`;
  const list = useLoad(() => listReceivedRequests({ filter, page }), listKey);
  const { notify } = useFeedback();
  const { refreshUser } = useSession();
  const [answering, setAnswering] = useState<{
    request: ReceivedRequest;
    action: AnswerAction;
  } | null>(null);
  // O texto do diálogo fica guardado: ele não pode mudar durante a animação de saída.
  const [dialogText, setDialogText] = useState({
    name: '',
    action: 'accept' as AnswerAction,
  });
  const [sending, setSending] = useState(false);
  // As respostas do servidor valem no lugar da solicitação antiga, só para a lista atual: ao
  // recarregar, a lista que o servidor devolve é a verdade.
  const [answered, setAnswered] = useState<{
    listKey: string;
    items: Record<number, ReceivedRequest>;
  }>({ listKey, items: {} });
  const overrides = answered.listKey === listKey ? answered.items : {};
  const cards = useRef(new Map<number, HTMLElement>());
  const { knownCount, lastPage } = usePageBounds(
    list,
    REQUESTS_PAGE_SIZE,
    page,
    setPage,
  );
  const empty = FILTERS.find((item) => item.value === filter)?.empty ?? '';

  const confirmAnswer = async () => {
    if (!answering || sending) return;
    const { request, action } = answering;
    setSending(true);
    try {
      const updated = await answerRequest(request.id, action);
      setAnswered({ listKey, items: { ...overrides, [updated.id]: updated } });
      setAnswering(null);
      notify(
        action === 'accept' ? 'Solicitação aceita.' : 'Solicitação recusada.',
        'success',
      );
      if (action === 'accept') void refreshUser();
      // O botão usado some do cartão: o foco vai para o próprio cartão, depois do diálogo.
      setTimeout(() => cards.current.get(updated.id)?.focus(), 350);
    } catch (error) {
      setAnswering(null);
      notify(
        error instanceof ApiError ? error.message : messageForStatus(0),
        'error',
      );
      // 409 e 404 dizem que a situação mudou: a lista é lida de novo.
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 404)
      ) {
        setListReload((current) => current + 1);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Solicitações
      </Typography>
      <FormControl component="fieldset">
        <FormLabel component="legend">Situação</FormLabel>
        <RadioGroup
          row
          value={filter}
          onChange={(event) => setFilter(event.target.value as RequestFilter)}
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
      {/* Uma frase curta numa região própria: reler a lista inteira a cada filtro seria ruído. */}
      <Typography role="status" aria-live="polite" color="text.secondary">
        {list.status === 'ready' && list.data.count > 0
          ? foundText(list.data.count)
          : ''}
      </Typography>
      <div ref={listTop}>
        {list.status === 'loading' && (
          <Stack spacing={2} data-testid="requests-skeleton" aria-hidden>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={150} />
            ))}
          </Stack>
        )}
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
          <Alert severity="info">{empty}</Alert>
        )}
        {list.status === 'ready' && list.data.items.length > 0 && (
          <Stack spacing={2}>
            {list.data.items.map((item) => {
              const request = overrides[item.id] ?? item;
              return (
                <RequestItem
                  key={request.id}
                  request={request}
                  cardRef={(element) => {
                    if (element) cards.current.set(request.id, element);
                    else cards.current.delete(request.id);
                  }}
                  onAnswer={(chosen, action) => {
                    setDialogText({ name: chosen.student.fullName, action });
                    setAnswering({ request: chosen, action });
                  }}
                />
              );
            })}
          </Stack>
        )}
      </div>
      <PagePagination
        ariaLabel="Paginação das solicitações"
        knownCount={knownCount}
        pageSize={REQUESTS_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={(next) => {
          setPage(next);
          listTop.current?.scrollIntoView?.({ block: 'start' });
        }}
      />
      <ConfirmDialog
        open={answering !== null}
        title={`${dialogText.action === 'accept' ? 'Aceitar' : 'Recusar'} a solicitação de ${dialogText.name}?`}
        message={
          dialogText.action === 'accept'
            ? 'Aceitar cria a orientação ativa com este aluno.'
            : 'O aluno será avisado da recusa. Não é preciso informar um motivo.'
        }
        confirmLabel={dialogText.action === 'accept' ? 'Aceitar' : 'Recusar'}
        confirmColor={dialogText.action === 'accept' ? 'primary' : 'error'}
        busy={sending}
        onCancel={() => setAnswering(null)}
        onConfirm={confirmAnswer}
      />
    </Stack>
  );
}
