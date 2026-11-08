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
import { useRef, useState } from 'react';
import {
  Link as RouterLink,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PagePagination } from '../components/PagePagination';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useSession } from '../hooks/useSession';
import { originState } from '../navigation/origin';
import { teacherStudentPath } from '../navigation/paths';
import { useReturnToLastPage, useUrlPage } from '../hooks/useUrlPage';
import {
  ApiError,
  isStateChangedError,
  messageForStatus,
} from '../services/apiError';
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

const FILTER_PARAM = 'situacao';

/** Só uma das cinco situações vale; qualquer outra coisa na URL é "Pendentes", o padrão. */
function filterFrom(value: string | null): RequestFilter {
  return FILTERS.find((item) => item.value === value)?.value ?? 'pending';
}

const DIALOG_COPY: Record<
  AnswerAction,
  {
    verb: string;
    message: string;
    color: 'primary' | 'error';
    done: string;
  }
> = {
  accept: {
    verb: 'Aceitar',
    message: 'Aceitar cria a orientação ativa com este aluno.',
    color: 'primary',
    done: 'Solicitação aceita.',
  },
  reject: {
    verb: 'Recusar',
    message:
      'O aluno será avisado da recusa. Não é preciso informar um motivo.',
    color: 'error',
    done: 'Solicitação recusada.',
  },
};

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'solicitação encontrada' : 'solicitações encontradas'}`;
}

export function TeacherRequestsPage() {
  const [listReload, setListReload] = useState(0);
  // O filtro e a página vivem na URL: recarregar ou voltar de outra tela, como o perfil do aluno,
  // os restaura. "Pendentes", o padrão, e a primeira página ficam sem parâmetro.
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = filterFrom(searchParams.get(FILTER_PARAM));
  const [page, setPage] = useUrlPage();
  const chooseFilter = (next: RequestFilter) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete('pagina');
      if (next === 'pending') params.delete(FILTER_PARAM);
      else params.set(FILTER_PARAM, next);
      return params;
    });
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
  const [dialogText, setDialogText] = useState<{
    name: string;
    action: AnswerAction;
  }>({ name: '', action: 'accept' });
  const [sending, setSending] = useState(false);
  // As respostas do servidor valem no lugar da solicitação antiga, só para a lista atual: ao
  // recarregar, a lista que o servidor devolve é a verdade.
  const [answeredRequests, setAnsweredRequests] = useState<{
    listKey: string;
    items: Record<number, ReceivedRequest>;
  }>({ listKey, items: {} });
  const overrides =
    answeredRequests.listKey === listKey ? answeredRequests.items : {};
  const cardElements = useRef(new Map<number, HTMLElement>());
  const focusAfterClose = useRef<number | null>(null);
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    REQUESTS_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);
  const emptyMessage =
    FILTERS.find((item) => item.value === filter)?.empty ?? '';

  const confirmAnswer = async () => {
    if (!answering || sending) return;
    const { request, action } = answering;
    setSending(true);
    try {
      const updated = await answerRequest(request.id, action);
      setAnsweredRequests({
        listKey,
        items: { ...overrides, [updated.id]: updated },
      });
      setAnswering(null);
      notify(DIALOG_COPY[action].done, 'success');
      if (action === 'accept') void refreshUser();
      // O botão usado some do cartão: o foco vai para o próprio cartão, quando o diálogo sair.
      focusAfterClose.current = updated.id;
    } catch (error) {
      setAnswering(null);
      notify(
        error instanceof ApiError ? error.message : messageForStatus(0),
        'error',
      );
      // 409 e 404 dizem que a situação mudou: a lista é lida de novo.
      if (isStateChangedError(error)) {
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
          <Alert severity="info">{emptyMessage}</Alert>
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
                    if (element) cardElements.current.set(request.id, element);
                    else cardElements.current.delete(request.id);
                  }}
                  wrapName={(name, item) => (
                    <Link
                      component={RouterLink}
                      to={teacherStudentPath(item.student.id)}
                      state={originState(location)}
                    >
                      {name}
                    </Link>
                  )}
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
        title={`${DIALOG_COPY[dialogText.action].verb} a solicitação de ${dialogText.name}?`}
        message={DIALOG_COPY[dialogText.action].message}
        confirmLabel={DIALOG_COPY[dialogText.action].verb}
        confirmColor={DIALOG_COPY[dialogText.action].color}
        busy={sending}
        onExited={() => {
          const id = focusAfterClose.current;
          focusAfterClose.current = null;
          if (id !== null) cardElements.current.get(id)?.focus();
        }}
        onCancel={() => setAnswering(null)}
        onConfirm={confirmAnswer}
      />
    </Stack>
  );
}
