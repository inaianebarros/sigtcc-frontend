import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFRESH_INTERVAL_MS } from '../hooks/useRefreshedLoad';
import { tokenStore } from '../services/tokenStore';
import { REQUEST_GONE_MESSAGE } from '../teacherRequests/requestFreshness';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { makeRequest, requestServer } from '../test/teacherRequestsApi';
import type { FakeRequest } from '../test/teacherRequestsApi';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const TEACHER_LIST = 'GET /api/orientacao/solicitacoes';
const STUDENT_STATUS = 'GET /api/orientacao/minha-solicitacao';
const STUDENT_LIST = 'GET /api/orientacao/minhas-solicitacoes';

// Um prazo que só vence muito depois do teste: a solicitação continua respondível.
const FAR_DEADLINE = '2099-01-01T12:00:00Z';

function pending(id: number, name: string): FakeRequest {
  return makeRequest(id, 'pending', {
    expires_at: FAR_DEADLINE,
    student: {
      id: 100 + id,
      full_name: name,
      course: { id: 10, name: 'Ciência da Computação' },
      areas: [],
    },
  });
}

/** Muda a solicitação no servidor, como a outra parte, o prazo (RN20) ou outra aba fariam. */
function changeOnServer(
  requests: FakeRequest[],
  id: number,
  change: Partial<FakeRequest>,
) {
  const found = requests.find((request) => request.id === id);
  if (!found) throw new Error(`Solicitação ${id} não existe`);
  Object.assign(found, change);
}

/** Um ciclo de releitura: 30 s com a aba visível. */
async function nextCycle() {
  // O ciclo é registrado num efeito: o `act` o descarrega antes de o relógio andar.
  await act(async () => {});
  await act(async () => {
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
  });
}

function setupTeacher(items: FakeRequest[], path = '/professor/solicitacoes') {
  const server = requestServer(items);
  const fetchMock = mockApi(server.routes);
  // Clique e digitação sem esperar o relógio falso: ele só anda quando o teste manda.
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderApp(path);
  return { fetchMock, user, requests: server.requests };
}

const location = () => screen.getByTestId('location').textContent;
const card = (name: string) => screen.getByRole('article', { name });

async function openDialog(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  action: 'Aceitar' | 'Recusar',
) {
  await screen.findByRole('article', { name });
  await user.click(within(card(name)).getByRole('button', { name: action }));
  return screen.findByRole('dialog');
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Solicitações do professor: a lista relida a cada 30 s', () => {
  it('mostra a nova solicitação e tira de Pendentes a que ficou sem resposta no prazo, sem esqueleto e com a busca na URL', async () => {
    const { fetchMock, requests } = setupTeacher(
      [pending(1, 'Ana Souza'), pending(2, 'Bruno Alves')],
      '/professor/solicitacoes?busca=a',
    );
    await screen.findByRole('article', { name: 'Ana Souza' });
    const reads = requestsTo(fetchMock, TEACHER_LIST).length;

    requests.push(pending(3, 'Carla Dias'));
    changeOnServer(requests, 2, { status: 'unanswered' });
    await nextCycle();

    expect(
      await screen.findByRole('article', { name: 'Carla Dias' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('article', { name: 'Bruno Alves' }),
    ).not.toBeInTheDocument();
    expect(card('Ana Souza')).toBeVisible();
    expect(requestsTo(fetchMock, TEACHER_LIST)).toHaveLength(reads + 1);
    expect(screen.queryByTestId('requests-skeleton')).not.toBeInTheDocument();
    expect(location()).toBe('/professor/solicitacoes?busca=a');
    expect(screen.getByRole('textbox', { name: 'Buscar aluno' })).toHaveValue(
      'a',
    );
  });

  it('em "Todas", a que ficou sem resposta no prazo perde os botões e o foco vai para o cartão dela', async () => {
    const { requests } = setupTeacher(
      [pending(1, 'Ana Souza'), pending(2, 'Bruno Alves')],
      '/professor/solicitacoes?situacao=all&pagina=1',
    );
    await screen.findByRole('article', { name: 'Bruno Alves' });
    const accept = within(card('Bruno Alves')).getByRole('button', {
      name: 'Aceitar',
    });
    act(() => accept.focus());

    changeOnServer(requests, 2, { status: 'unanswered' });
    await nextCycle();

    const expired = card('Bruno Alves');
    expect(await within(expired).findByText('Não respondida')).toBeVisible();
    expect(within(expired).queryByRole('button')).not.toBeInTheDocument();
    expect(expired).toHaveFocus();
    expect(location()).toBe('/professor/solicitacoes?situacao=all&pagina=1');
  });

  it('em Pendentes, a que saiu da lista com o foco leva o foco ao título, sem deixá-lo perdido na página', async () => {
    const { requests } = setupTeacher([
      pending(1, 'Ana Souza'),
      pending(2, 'Bruno Alves'),
    ]);
    await screen.findByRole('article', { name: 'Bruno Alves' });
    const accept = within(card('Bruno Alves')).getByRole('button', {
      name: 'Aceitar',
    });
    act(() => accept.focus());

    changeOnServer(requests, 2, { status: 'unanswered' });
    await nextCycle();

    await waitFor(() =>
      expect(
        screen.queryByRole('article', { name: 'Bruno Alves' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Solicitações' }),
    ).toHaveFocus();
  });

  it('não move o foco que está fora da lista', async () => {
    const { requests } = setupTeacher([
      pending(1, 'Ana Souza'),
      pending(2, 'Bruno Alves'),
    ]);
    await screen.findByRole('article', { name: 'Bruno Alves' });
    const search = screen.getByRole('textbox', { name: 'Buscar aluno' });
    act(() => search.focus());

    changeOnServer(requests, 2, { status: 'unanswered' });
    requests.push(pending(3, 'Carla Dias'));
    await nextCycle();

    await screen.findByRole('article', { name: 'Carla Dias' });
    expect(search).toHaveFocus();
  });

  it('a solicitação respondida aqui continua no lugar, com a resposta e o foco, quando a releitura a tira de Pendentes', async () => {
    const { fetchMock, user } = setupTeacher([
      pending(1, 'Ana Souza'),
      pending(2, 'Bruno Alves'),
    ]);
    const dialog = await openDialog(user, 'Ana Souza', 'Aceitar');
    await user.click(within(dialog).getByRole('button', { name: 'Aceitar' }));
    await waitFor(() => expect(card('Ana Souza')).toHaveFocus());
    const reads = requestsTo(fetchMock, TEACHER_LIST).length;

    await nextCycle();

    await waitFor(() =>
      expect(requestsTo(fetchMock, TEACHER_LIST).length).toBe(reads + 1),
    );
    const answered = card('Ana Souza');
    expect(within(answered).getByText('Aceita')).toBeVisible();
    expect(answered).toHaveFocus();
    // A ordem não muda: a respondida fica onde estava.
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((title) => title.textContent),
    ).toEqual(['Ana Souza', 'Bruno Alves']);
    expect(screen.queryByText('Nenhuma solicitação pendente.')).toBeNull();
  });

  it('anuncia o total só quando ele muda', async () => {
    const { requests } = setupTeacher([pending(1, 'Ana Souza')]);
    await screen.findByRole('article', { name: 'Ana Souza' });
    const status = screen.getByText('1 solicitação encontrada');

    await nextCycle();
    expect(status).toHaveTextContent('1 solicitação encontrada');

    requests.push(pending(2, 'Bruno Alves'));
    await nextCycle();
    await screen.findByRole('article', { name: 'Bruno Alves' });
    expect(status).toHaveTextContent('2 solicitações encontradas');
  });
});

describe('Solicitações do professor: o diálogo aberto quando a solicitação muda', () => {
  it('continua aberto, avisa que o prazo foi encerrado e desabilita Aceitar, com o mesmo rótulo', async () => {
    const { user, requests } = setupTeacher(
      [pending(1, 'Ana Souza')],
      '/professor/solicitacoes?situacao=all',
    );
    const dialog = await openDialog(user, 'Ana Souza', 'Aceitar');
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(
      within(dialog).getByRole('button', { name: 'Aceitar' }),
    ).toBeEnabled();

    changeOnServer(requests, 1, { status: 'unanswered' });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'O prazo para responder a esta solicitação foi encerrado, e ela não pode mais ser aceita. O aluno pode enviar uma nova solicitação.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(
      within(dialog).getByRole('button', { name: 'Aceitar' }),
    ).toBeDisabled();
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      /prazo para responder a esta solicitação foi encerrado/,
    );
  });

  it('em Pendentes, a que passou do prazo e saiu da lista também recebe o aviso do prazo', async () => {
    const { user, requests } = setupTeacher([
      makeRequest(1, 'pending', { expires_at: '2026-11-09T14:30:00Z' }),
      pending(2, 'Bruno Alves'),
    ]);
    const dialog = await openDialog(user, 'Aluno 1', 'Recusar');

    changeOnServer(requests, 1, { status: 'unanswered' });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'O prazo para responder a esta solicitação foi encerrado, e ela não pode mais ser recusada.',
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Recusar' }),
    ).toBeDisabled();
  });

  it.each([
    ['accepted', 'Aceitar', 'Esta solicitação já foi aceita.'],
    [
      'accepted',
      'Recusar',
      'Esta solicitação foi aceita e não pode mais ser recusada.',
    ],
    [
      'rejected',
      'Aceitar',
      'Esta solicitação foi recusada e não pode mais ser aceita.',
    ],
    ['rejected', 'Recusar', 'Esta solicitação já foi recusada.'],
  ] as const)(
    'respondida em outra aba (%s), o diálogo %s avisa e bloqueia',
    async (status, action, text) => {
      const { user, requests } = setupTeacher(
        [pending(1, 'Ana Souza')],
        '/professor/solicitacoes?situacao=all',
      );
      const dialog = await openDialog(user, 'Ana Souza', action);

      changeOnServer(requests, 1, { status });
      await nextCycle();

      expect(await within(dialog).findByText(text)).toBeVisible();
      expect(
        within(dialog).getByRole('button', { name: action }),
      ).toBeDisabled();
    },
  );

  it('sumiu da página sem o prazo vencer: avisa que mudou de situação ou de página, bloqueia e, ao fechar, leva o foco ao título', async () => {
    const { user, requests } = setupTeacher([
      pending(1, 'Ana Souza'),
      pending(2, 'Bruno Alves'),
    ]);
    const dialog = await openDialog(user, 'Bruno Alves', 'Aceitar');

    changeOnServer(requests, 2, { status: 'accepted' });
    await nextCycle();

    expect(await within(dialog).findByText(REQUEST_GONE_MESSAGE)).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Aceitar' }),
    ).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Solicitações' }),
    ).toHaveFocus();
  });

  it('sem mudança, o diálogo não ganha aviso e o foco volta ao botão ao cancelar', async () => {
    const { user } = setupTeacher([pending(1, 'Ana Souza')]);
    const dialog = await openDialog(user, 'Ana Souza', 'Recusar');

    await nextCycle();

    expect(within(dialog).getByRole('status')).toBeEmptyDOMElement();
    expect(
      within(dialog).getByRole('button', { name: 'Recusar' }),
    ).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      within(card('Ana Souza')).getByRole('button', { name: 'Recusar' }),
    ).toHaveFocus();
  });
});

interface StudentItem {
  id: number;
  status: string;
  requested_at: string;
  responded_at: string | null;
  expires_at: string | null;
  teacher: { id: number; full_name: string; institute: unknown };
  advising: unknown;
}

function studentItem(
  id: number,
  name: string,
  status = 'rejected',
): StudentItem {
  return {
    id,
    status,
    requested_at: '2026-11-02T15:00:00Z',
    responded_at: status === 'pending' ? null : '2026-11-03T15:00:00Z',
    expires_at: status === 'pending' ? FAR_DEADLINE : null,
    teacher: { id: 200 + id, full_name: name, institute: null },
    advising: null,
  };
}

const WAITING = {
  request: null,
  advising: null,
  can_request: false,
  blocked_reason: 'pending_request',
};

/** O servidor do aluno: pagina de 10 em 10, e o teste muda a lista e a elegibilidade. */
function setupStudent(items: StudentItem[], path: string) {
  let eligibility: Record<string, unknown> = WAITING;
  const fetchMock = mockApi({
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': {
      body: {
        id: 7,
        full_name: 'Ana Souza',
        email: 'ana@example.com',
        type: 'student',
        has_active_advising: false,
      },
    },
    [STUDENT_STATUS]: () => ({ body: eligibility }),
    [STUDENT_LIST]: (_body: unknown, url: URL) => {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return {
        body: { items: items.slice(offset, offset + 10), count: items.length },
      };
    },
  });
  renderApp(path);
  return {
    fetchMock,
    serveEligibility: (next: Record<string, unknown>) => {
      eligibility = next;
    },
  };
}

function elevenRequests(): StudentItem[] {
  return Array.from({ length: 11 }, (_, index) =>
    studentItem(
      index + 1,
      `Professor ${String(index + 1).padStart(2, '0')}`,
      index === 10 ? 'pending' : 'rejected',
    ),
  );
}

describe('Minhas solicitações do aluno: a lista relida a cada 30 s', () => {
  it('mostra o aceite do professor e a nova elegibilidade, na mesma página e busca, sem esqueleto', async () => {
    const items = elevenRequests();
    const { fetchMock, serveEligibility } = setupStudent(
      items,
      '/aluno/solicitacao?pagina=2&busca=Professor',
    );
    const pendingCard = await screen.findByRole('article', {
      name: 'Professor 11',
    });
    expect(within(pendingCard).getByText('Pendente')).toBeVisible();
    expect(
      screen.getByText(/Você já tem uma solicitação aguardando resposta/),
    ).toBeVisible();
    const reads = requestsTo(fetchMock, STUDENT_LIST).length;

    Object.assign(items[10]!, {
      status: 'accepted',
      responded_at: '2026-11-04T15:00:00Z',
      expires_at: null,
      advising: {
        id: 3,
        status: 'active',
        started_at: '2026-11-04T15:00:00Z',
        ended_at: null,
      },
    });
    serveEligibility({
      request: null,
      advising: {
        id: 3,
        started_at: '2026-11-04T15:00:00Z',
        teacher: { id: 211, full_name: 'Professor 11' },
      },
      can_request: false,
      blocked_reason: 'active_advising',
    });
    await nextCycle();

    const accepted = screen.getByRole('article', { name: 'Professor 11' });
    expect(await within(accepted).findByText('Aceita')).toBeVisible();
    expect(within(accepted).getByText('Orientação ativa')).toBeVisible();
    expect(
      await screen.findByText(/Você já tem um orientador ativo/),
    ).toBeVisible();
    expect(requestsTo(fetchMock, STUDENT_LIST)).toHaveLength(reads + 1);
    expect(screen.queryByTestId('request-skeleton')).not.toBeInTheDocument();
    expect(location()).toBe('/aluno/solicitacao?pagina=2&busca=Professor');
    const last = requestsTo(fetchMock, STUDENT_LIST).at(-1)?.[0];
    const params = new URL(String(last), 'http://localhost').searchParams;
    expect(params.get('offset')).toBe('10');
    expect(params.get('name')).toBe('Professor');
  });

  it.each([
    ['rejected', 'Recusada', 'Recusada em 04/11/2026'],
    ['unanswered', 'Não respondida', 'Sem resposta do professor'],
  ] as const)(
    'mostra a solicitação %s e libera o pedido de outra orientação',
    async (status, label, line) => {
      const items = [studentItem(1, 'Carlos Lima', 'pending')];
      const { serveEligibility } = setupStudent(items, '/aluno/solicitacao');
      await screen.findByText('Pendente');

      Object.assign(items[0]!, {
        status,
        responded_at: status === 'rejected' ? '2026-11-04T15:00:00Z' : null,
        expires_at: status === 'unanswered' ? '2026-11-09T15:00:00Z' : null,
      });
      serveEligibility({
        request: null,
        advising: null,
        can_request: true,
        blocked_reason: null,
      });
      await nextCycle();

      const answered = screen.getByRole('article', { name: 'Carlos Lima' });
      expect(await within(answered).findByText(label)).toBeVisible();
      expect(within(answered).getByText(line)).toBeVisible();
      expect(
        await screen.findByRole('link', { name: 'Buscar orientadores' }),
      ).toBeVisible();
      expect(
        screen.queryByText(/Você já tem uma solicitação aguardando resposta/),
      ).not.toBeInTheDocument();
    },
  );
});
