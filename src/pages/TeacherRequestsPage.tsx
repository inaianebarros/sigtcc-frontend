import {
  Alert,
  Button,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChangedNotice } from '../components/ChangedNotice';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PagePagination } from '../components/PagePagination';
import { UrlSearchField } from '../components/UrlSearchField';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { useFeedback } from '../hooks/useFeedback';
import { useListFocusKeeper } from '../hooks/useListFocusKeeper';
import { usePageBounds } from '../hooks/usePageBounds';
import { useRefreshedLoad } from '../hooks/useRefreshedLoad';
import { useSession } from '../hooks/useSession';
import { OriginLink } from '../navigation/OriginLink';
import { teacherStudentPath } from '../navigation/paths';
import {
  PAGE_PARAM,
  useReturnToLastPage,
  useUrlPage,
} from '../hooks/useUrlPage';
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
import { noticeForAnswer } from '../teacherRequests/requestFreshness';

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
const SEARCH_PARAM = 'busca';

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

/** Uma solicitação respondida nesta tela e a posição em que estava na lista. */
interface AnsweredRequest {
  request: ReceivedRequest;
  index: number;
}

/**
 * A lista na tela: a que o servidor devolveu, com as respostas dadas aqui no lugar da versão
 * antiga. Uma solicitação respondida aqui fica na lista, na mesma posição, até a página ou o filtro
 * mudar, mesmo que a releitura não a traga mais (como em "Pendentes"): o cartão dela tem o foco e
 * mostra a resposta.
 */
function withAnswered(
  items: readonly ReceivedRequest[],
  answered: Record<number, AnsweredRequest>,
): ReceivedRequest[] {
  const shown = items.map((item) => answered[item.id]?.request ?? item);
  const missing = Object.values(answered)
    .filter(({ request }) => !shown.some((item) => item.id === request.id))
    .sort((first, second) => first.index - second.index);
  for (const { request, index } of missing) {
    shown.splice(Math.min(index, shown.length), 0, request);
  }
  return shown;
}

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'solicitação encontrada' : 'solicitações encontradas'}`;
}

export function TeacherRequestsPage() {
  // O filtro e a página vivem na URL: recarregar ou voltar de outra tela, como o perfil do aluno,
  // os restaura. "Pendentes", o padrão, e a primeira página ficam sem parâmetro.
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = filterFrom(searchParams.get(FILTER_PARAM));
  const search = (searchParams.get(SEARCH_PARAM) ?? '').trim();
  const [page, setPage] = useUrlPage();
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
      if (next === 'pending') params.delete(FILTER_PARAM);
      else params.set(FILTER_PARAM, next);
      return params;
    });
  const listTop = useRef<HTMLDivElement>(null);
  const listKey = `${filter}|${page}|${search}`;
  // A lista se relê a cada 30 s e ao voltar para a aba ou para a janela, sem esqueleto: chegam as
  // novas solicitações e as que ficaram sem resposta no prazo (RN20, ADR frontend 0006).
  const { state: list, retry: retryList } = useRefreshedLoad(
    () => listReceivedRequests({ filter, page, name: search }),
    listKey,
  );
  const { notify } = useFeedback();
  const { refreshUser } = useSession();
  const [answering, setAnswering] = useState<{
    request: ReceivedRequest;
    action: AnswerAction;
  } | null>(null);
  // O texto do diálogo fica guardado: ele não pode mudar durante a animação de saída.
  const [dialogText, setDialogText] = useState<{
    requestId: number;
    name: string;
    action: AnswerAction;
  }>({ requestId: 0, name: '', action: 'accept' });
  const [sending, setSending] = useState(false);
  // As respostas dadas aqui valem no lugar da versão relida, só para a lista atual (filtro, página
  // e busca): uma solicitação respondida não muda mais (RN06), então a releitura não as contradiz.
  const [answeredRequests, setAnsweredRequests] = useState<{
    listKey: string;
    items: Record<number, AnsweredRequest>;
  }>({ listKey, items: {} });
  const overrides =
    answeredRequests.listKey === listKey ? answeredRequests.items : {};
  const shownItems =
    list.status === 'ready' ? withAnswered(list.data.items, overrides) : [];
  // Se a releitura tira da tela o que tinha o foco (a solicitação ficou sem resposta no prazo e
  // perdeu os botões, ou saiu de "Pendentes"), o foco vai para o cartão dela ou para o título.
  const heading = useRef<HTMLHeadingElement>(null);
  const cards = useListFocusKeeper(heading);
  const focusAfterClose = useRef<number | null>(null);
  // O botão que abriu o diálogo: se a releitura o tirou da tela, o foco não volta a ele.
  const openedFrom = useRef<HTMLElement | null>(null);
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    REQUESTS_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);
  // O diálogo aberto acompanha a solicitação na última leitura da lista: se ela deixou de poder ser
  // respondida, ele continua aberto, avisa por quê e desabilita a confirmação.
  const notice =
    answering !== null && list.status === 'ready'
      ? noticeForAnswer(
          answering.action,
          answering.request,
          shownItems.find((item) => item.id === answering.request.id),
        )
      : null;
  const emptyMessage =
    FILTERS.find((item) => item.value === filter)?.empty ?? '';

  const confirmAnswer = async () => {
    if (!answering || sending) return;
    const { request, action } = answering;
    setSending(true);
    try {
      const updated = await answerRequest(request.id, action);
      const index = shownItems.findIndex((item) => item.id === updated.id);
      setAnsweredRequests({
        listKey,
        items: {
          ...overrides,
          [updated.id]: { request: updated, index: Math.max(index, 0) },
        },
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
      if (isStateChangedError(error)) retryList();
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack spacing={3}>
      <div>
        <Typography
          ref={heading}
          variant="h4"
          component="h1"
          gutterBottom
          tabIndex={-1}
        >
          Solicitações
        </Typography>
        <Typography color="text.secondary">
          Responda às solicitações de orientação dos seus alunos.
        </Typography>
      </div>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'flex-start' } }}
      >
        <UrlSearchField
          grow
          label="Buscar aluno"
          placeholder="Digite o nome do aluno..."
          value={search}
          onSearch={changeSearch}
        />
        <TextField
          select
          label="Situação"
          value={filter}
          onChange={(event) => {
            const chosen = FILTERS.find(
              (item) => item.value === event.target.value,
            );
            if (chosen) chooseFilter(chosen.value);
          }}
          sx={{ minWidth: { sm: 200 } }}
        >
          {FILTERS.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {/* Só para leitor de tela: uma frase curta numa região própria, pois reler os cartões a cada filtro seria ruído. */}
      <VisuallyHidden role="status" aria-live="polite">
        {list.status === 'ready' && list.data.count > 0
          ? foundText(list.data.count)
          : ''}
      </VisuallyHidden>
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
            <Button onClick={retryList} sx={{ alignSelf: 'flex-start' }}>
              Tentar novamente
            </Button>
          </Stack>
        )}
        {list.status === 'ready' &&
          shownItems.length === 0 &&
          search === '' && <Alert severity="info">{emptyMessage}</Alert>}
        {list.status === 'ready' &&
          shownItems.length === 0 &&
          search !== '' && (
            <Stack spacing={2}>
              <Alert severity="info">
                Nenhuma solicitação encontrada para essa busca. Confira o nome
                do aluno e tente de novo.
              </Alert>
              <Button
                onClick={() => changeSearch('')}
                sx={{ alignSelf: 'flex-start' }}
              >
                Limpar busca
              </Button>
            </Stack>
          )}
        {shownItems.length > 0 && (
          <Stack spacing={2} {...cards.containerProps}>
            {shownItems.map((request) => (
              <RequestItem
                key={request.id}
                request={request}
                cardRef={cards.itemRef(request.id)}
                wrapName={(name, item) => (
                  <OriginLink to={teacherStudentPath(item.student.id)}>
                    {name}
                  </OriginLink>
                )}
                onAnswer={(chosen, action) => {
                  const opener = document.activeElement;
                  openedFrom.current =
                    opener instanceof HTMLElement ? opener : null;
                  setDialogText({
                    requestId: chosen.id,
                    name: chosen.student.fullName,
                    action,
                  });
                  setAnswering({ request: chosen, action });
                }}
              />
            ))}
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
        notice={<ChangedNotice message={notice} />}
        actionBlocked={notice !== null}
        onExited={() => {
          const answeredId = focusAfterClose.current;
          const opener = openedFrom.current;
          focusAfterClose.current = null;
          openedFrom.current = null;
          if (answeredId !== null) {
            cards.focusItem(answeredId);
          } else if (opener === null || !opener.isConnected) {
            // A releitura tirou o botão da tela enquanto o diálogo estava aberto.
            cards.focusItem(dialogText.requestId);
          }
        }}
        onCancel={() => setAnswering(null)}
        onConfirm={confirmAnswer}
      />
    </Stack>
  );
}
