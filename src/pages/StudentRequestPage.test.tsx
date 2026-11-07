import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const STATUS = 'GET /api/orientacao/minha-solicitacao';
const ME = 'GET /api/auth/me';
const TEACHER = { id: 9, full_name: 'Carlos Lima' };

const NEVER = {
  request: null,
  advising: null,
  can_request: true,
  blocked_reason: null,
};

function request(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 5,
    status,
    requested_at: '2026-11-02T14:30:00Z',
    responded_at: null,
    expires_at: '2026-11-09T14:30:00Z',
    teacher: TEACHER,
    ...extra,
  };
}

function routes(status: Record<string, unknown>) {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    [ME]: {
      body: {
        id: 7,
        full_name: 'Ana Souza',
        email: 'ana@example.com',
        type: 'student',
        has_active_advising: false,
      },
    },
    [STATUS]: { body: status },
  };
}

function setup(status: Record<string, unknown>) {
  const fetchMock = mockApi(routes(status));
  const user = userEvent.setup();
  renderApp('/aluno/solicitacao');
  return { fetchMock, user };
}

describe('StudentRequestPage: os estados da solicitação', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('para quem nunca solicitou, mostra o estado vazio e o link para a busca', async () => {
    setup(NEVER);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Minha solicitação',
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Você ainda não enviou nenhuma solicitação de orientação.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Buscar orientadores' }),
    ).toHaveAttribute('href', '/aluno/orientadores');
  });

  it('mostra a solicitação pendente com o professor, a data de envio e o prazo, sem cancelar nem pedir de novo', async () => {
    setup({
      request: request('pending'),
      advising: null,
      can_request: false,
      blocked_reason: 'pending_request',
    });

    const card = await screen.findByRole('article', { name: /Carlos Lima/ });
    expect(
      within(card).getByText('Enviada em 2 de novembro de 2026'),
    ).toBeVisible();
    expect(
      within(card).getByText(
        'O professor tem até 9 de novembro de 2026, às 11:30, para responder.',
      ),
    ).toBeVisible();
    expect(within(card).getByText('Pendente')).toBeVisible();
    expect(
      screen.getByText(/Você já tem uma solicitação aguardando resposta/),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /cancelar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Buscar orientadores' }),
    ).not.toBeInTheDocument();
  });

  it('mostra a solicitação recusada, sem motivo, e permite pedir de novo, até ao mesmo professor', async () => {
    setup({
      request: request('rejected', {
        responded_at: '2026-11-03T12:00:00Z',
        expires_at: null,
      }),
      advising: null,
      can_request: true,
      blocked_reason: null,
    });

    const card = await screen.findByRole('article', { name: /Carlos Lima/ });
    expect(within(card).getByText('Recusada')).toBeVisible();
    expect(screen.getByText(/O professor recusou a solicitação/)).toBeVisible();
    expect(screen.getByText(/mesmo professor/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Buscar orientadores' }),
    ).toHaveAttribute('href', '/aluno/orientadores');
  });

  it('mostra a solicitação não respondida, avisa que o prazo acabou e permite pedir de novo', async () => {
    setup({
      request: request('unanswered'),
      advising: null,
      can_request: true,
      blocked_reason: null,
    });

    const card = await screen.findByRole('article', { name: /Carlos Lima/ });
    expect(within(card).getByText('Não respondida')).toBeVisible();
    expect(screen.getByText(/não respondeu dentro do prazo/)).toBeVisible();
    expect(screen.queryByText(/7 dias/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Buscar orientadores' }),
    ).toBeInTheDocument();
  });

  it('mostra a solicitação aceita com a orientação ativa, o orientador e o início, e explica por que não dá para pedir outra', async () => {
    setup({
      request: request('accepted', {
        responded_at: '2026-11-03T12:00:00Z',
        expires_at: null,
      }),
      advising: {
        id: 3,
        started_at: '2026-11-03T12:00:00Z',
        teacher: TEACHER,
      },
      can_request: false,
      blocked_reason: 'active_advising',
    });

    expect(
      await screen.findByRole('article', { name: /Carlos Lima/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Aceita')).toBeVisible();
    const advising = screen.getByRole('region', { name: 'Orientação ativa' });
    expect(within(advising).getByText('Carlos Lima')).toBeVisible();
    expect(
      within(advising).getByText('Desde 3 de novembro de 2026'),
    ).toBeVisible();
    expect(screen.getByText(/Você já tem um orientador ativo/)).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Buscar orientadores' }),
    ).not.toBeInTheDocument();
  });
});

const ACCEPTED = {
  request: request('accepted', {
    responded_at: '2026-11-03T12:00:00Z',
    expires_at: null,
  }),
  advising: { id: 3, started_at: '2026-11-03T12:00:00Z', teacher: TEACHER },
  can_request: false,
  blocked_reason: 'active_advising',
};

const PENDING = {
  request: request('pending'),
  advising: null,
  can_request: false,
  blocked_reason: 'pending_request',
};

describe('StudentRequestPage: sessão, carregamento e releitura', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('relê o usuário uma única vez quando vê a orientação ativa, para o menu habilitar os itens que dependem dela', async () => {
    const { fetchMock } = setup(ACCEPTED);
    await screen.findByText('Aceita');

    await waitFor(() => expect(requestsTo(fetchMock, ME)).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(requestsTo(fetchMock, ME)).toHaveLength(2);
  });

  it('não relê o usuário quando a solicitação ainda está pendente', async () => {
    const { fetchMock } = setup(PENDING);
    await screen.findByText('Pendente');
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(requestsTo(fetchMock, ME)).toHaveLength(1);
  });

  it('mostra um esqueleto enquanto carrega', async () => {
    const fetchMock = mockApi({
      ...routes(NEVER),
      [STATUS]: () => new Promise(() => undefined),
    });
    renderApp('/aluno/solicitacao');

    await waitFor(() => expect(requestsTo(fetchMock, STATUS)).toHaveLength(1));

    expect(screen.getByTestId('request-skeleton')).toBeInTheDocument();
  });

  it('mostra o erro de carregamento e tenta de novo', async () => {
    let attempts = 0;
    mockApi({
      ...routes(NEVER),
      [STATUS]: () => {
        attempts += 1;
        return attempts === 1 ? { status: 500, body: {} } : { body: NEVER };
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno/solicitacao');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(
      await screen.findByText(
        'Você ainda não enviou nenhuma solicitação de orientação.',
      ),
    ).toBeVisible();
  });

  it('relê ao voltar para a aba, sem esconder o que já está na tela, e mostra a resposta do professor', async () => {
    let answered = false;
    const fetchMock = mockApi({
      ...routes(PENDING),
      [STATUS]: () => ({ body: answered ? ACCEPTED : PENDING }),
    });
    renderApp('/aluno/solicitacao');
    await screen.findByText('Pendente');
    answered = true;

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(screen.queryByTestId('request-skeleton')).not.toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeVisible();
    expect(await screen.findByText('Aceita')).toBeVisible();
    expect(requestsTo(fetchMock, STATUS).length).toBeGreaterThanOrEqual(2);
  });

  it('mantém o que está na tela quando a releitura falha, mas avisa que pode estar desatualizado e oferece atualizar', async () => {
    let fail = false;
    mockApi({
      ...routes(PENDING),
      [STATUS]: () => (fail ? { status: 500, body: {} } : { body: PENDING }),
    });
    const user = userEvent.setup();
    renderApp('/aluno/solicitacao');
    await screen.findByText('Pendente');
    fail = true;

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(await screen.findByText(/pode estar desatualizado/)).toBeVisible();
    expect(screen.getByText('Pendente')).toBeVisible();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() =>
      expect(
        screen.queryByText(/pode estar desatualizado/),
      ).not.toBeInTheDocument(),
    );
  });

  it('junta o foco da janela e a visibilidade da aba numa só releitura', async () => {
    const fetchMock = mockApi(routes(PENDING));
    renderApp('/aluno/solicitacao');
    await screen.findByText('Pendente');
    const before = requestsTo(fetchMock, STATUS).length;

    // No navegador os dois eventos chegam em momentos diferentes, e cada um renderiza sozinho.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(requestsTo(fetchMock, STATUS)).toHaveLength(before + 1);
  });

  it('com a solicitação aceita mas sem orientação ativa (ela já foi encerrada), diz isso e não relê o usuário', async () => {
    const { fetchMock } = setup({
      request: request('accepted', {
        responded_at: '2026-11-03T12:00:00Z',
        expires_at: null,
      }),
      advising: null,
      can_request: true,
      blocked_reason: null,
    });

    expect(
      await screen.findByText(/A orientação já foi encerrada/),
    ).toBeVisible();
    expect(
      screen.queryByText(/a orientação está ativa/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Buscar orientadores' }),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(requestsTo(fetchMock, ME)).toHaveLength(1);
  });

  it('não repete que a orientação está ativa na solicitação quando o cartão da orientação já diz isso', async () => {
    setup(ACCEPTED);
    await screen.findByText('Aceita');

    expect(
      screen.getByText('O professor aceitou a sua solicitação.'),
    ).toBeVisible();
    expect(
      screen.queryByText(/a orientação está ativa/),
    ).not.toBeInTheDocument();
  });

  it('explica um status desconhecido em vez de deixar um parágrafo vazio', async () => {
    setup({
      request: request('em_analise'),
      advising: null,
      can_request: true,
      blocked_reason: null,
    });

    expect(
      await screen.findByText(/Não foi possível identificar a situação/),
    ).toBeVisible();
  });

  it('não derruba a tela diante de uma data malformada', async () => {
    setup({
      request: request('pending', { requested_at: 'lixo', expires_at: '' }),
      advising: null,
      can_request: false,
      blocked_reason: 'pending_request',
    });

    expect(await screen.findByText('Pendente')).toBeVisible();
    expect(screen.getAllByText(/data indisponível/).length).toBeGreaterThan(0);
  });
});

describe('StudentRequestPage: leitura sem depender de cor, celular e status novo', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it.each([
    ['pending', 'Pendente'],
    ['accepted', 'Aceita'],
    ['rejected', 'Recusada'],
    ['unanswered', 'Não respondida'],
  ])(
    'diz o status %s em texto, com um ícone decorativo, dentro de uma região anunciada',
    async (status, label) => {
      const { fetchMock } = setup({
        request: request(status),
        advising: null,
        can_request: true,
        blocked_reason: null,
      });
      expect(fetchMock).toBeDefined();

      const text = await screen.findByText(label);

      const region = text.closest('[role="status"]');
      expect(region).not.toBeNull();
      expect(region?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    },
  );

  it('não derruba a tela diante de um status que ela ainda não conhece', async () => {
    setup({
      request: request('em_analise'),
      advising: null,
      can_request: true,
      blocked_reason: null,
    });

    expect(await screen.findByText('Situação desconhecida')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Buscar orientadores' }),
    ).toBeInTheDocument();
  });

  it('funciona em tela pequena e o link leva à busca', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { user } = setup({
      request: request('rejected', { expires_at: null }),
      advising: null,
      can_request: true,
      blocked_reason: null,
    });

    await user.click(
      await screen.findByRole('link', { name: 'Buscar orientadores' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Orientadores' }),
    ).toBeInTheDocument();
  });
});
