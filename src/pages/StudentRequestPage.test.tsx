import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const STATUS = 'GET /api/orientacao/minha-solicitacao';
const LIST = 'GET /api/orientacao/minhas-solicitacoes';
const ME = 'GET /api/auth/me';
const INSTITUTE = { id: 1, name: 'Instituto de Engenharia e Geociências' };

const NEVER = {
  request: null,
  advising: null,
  can_request: true,
  blocked_reason: null,
};

interface FakeItem {
  id: number;
  status: string;
  requested_at: string;
  responded_at: string | null;
  expires_at: string | null;
  teacher: { id: number; full_name: string; institute: unknown };
  advising: unknown;
}

function item(
  id: number,
  status: string,
  extra: Partial<FakeItem> = {},
): FakeItem {
  return {
    id,
    status,
    requested_at: '2026-11-02T15:00:00Z',
    responded_at: null,
    expires_at: null,
    teacher: { id: 9, full_name: 'Carlos Lima', institute: INSTITUTE },
    advising: null,
    ...extra,
  };
}

function many(count: number): FakeItem[] {
  return Array.from({ length: count }, (_, index) =>
    item(index + 1, 'rejected', {
      teacher: {
        id: 100 + index,
        full_name: `Professor ${String(index + 1).padStart(2, '0')}`,
        institute: INSTITUTE,
      },
    }),
  );
}

/** O servidor simulado: pagina de 10 em 10 e filtra pelo nome, sem acento nem maiúsculas. */
function listOf(items: FakeItem[]) {
  return (_body: unknown, url: URL) => {
    const name = (url.searchParams.get('name') ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const matching = items.filter((entry) =>
      entry.teacher.full_name
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .includes(name),
    );
    return {
      body: {
        items: matching.slice(offset, offset + 10),
        count: matching.length,
      },
    };
  };
}

function routes(items: FakeItem[], status: Record<string, unknown> = NEVER) {
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
    [LIST]: listOf(items),
  };
}

function setup(
  items: FakeItem[],
  status: Record<string, unknown> = NEVER,
  path = '/aluno/solicitacao',
) {
  const fetchMock = mockApi(routes(items, status));
  const user = userEvent.setup();
  renderApp(path);
  return { fetchMock, user };
}

const heading = () =>
  screen.findByRole('heading', { level: 1, name: 'Minhas solicitações' });

function listRequests(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, LIST).map(([input]) => {
    const params = new URL(String(input), 'http://localhost').searchParams;
    return { offset: params.get('offset'), name: params.get('name') };
  });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('StudentRequestPage: a lista de solicitações (RF16)', () => {
  it('para quem nunca solicitou, mostra o estado vazio com um só link para a busca', async () => {
    setup([]);
    await heading();

    expect(
      await screen.findByText(
        'Você ainda não enviou nenhuma solicitação de orientação.',
      ),
    ).toBeVisible();
    expect(
      screen.getAllByRole('link', { name: 'Buscar orientadores' }),
    ).toHaveLength(1);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('mostra o título e a frase de apoio', async () => {
    setup([item(1, 'rejected')]);

    expect(await heading()).toBeInTheDocument();
    expect(
      screen.getByText(
        'Acompanhe o status das suas solicitações de orientação.',
      ),
    ).toBeVisible();
  });

  it('um cartão tem o professor com o link para o perfil, o instituto, a data de envio e a situação', async () => {
    setup([item(1, 'rejected', { responded_at: '2026-11-03T15:00:00Z' })]);

    const card = await screen.findByRole('article', { name: 'Carlos Lima' });

    expect(
      within(card).getByRole('link', { name: 'Carlos Lima' }),
    ).toHaveAttribute('href', '/aluno/orientadores/9');
    expect(
      within(card).getByText('Instituto de Engenharia e Geociências'),
    ).toBeVisible();
    expect(within(card).getByText('Enviada em 02/11/2026')).toBeVisible();
    expect(within(card).getByText('Recusada')).toBeVisible();
    expect(within(card).getByText('Recusada em 03/11/2026')).toBeVisible();
  });

  it.each([
    [
      'pending',
      'Pendente',
      { expires_at: '2026-11-09T15:00:00Z' },
      'Pode ser respondida até 09/11/2026',
    ],
    [
      'accepted',
      'Aceita',
      { responded_at: '2026-11-04T15:00:00Z' },
      'Aceita em 04/11/2026',
    ],
    [
      'rejected',
      'Recusada',
      { responded_at: '2026-11-03T15:00:00Z' },
      'Recusada em 03/11/2026',
    ],
    [
      'unanswered',
      'Não respondida',
      { expires_at: '2026-11-09T15:00:00Z' },
      'Sem resposta do professor',
    ],
  ])(
    'a situação %s aparece em texto, com ícone, e com a linha de datas certa',
    async (status, label, extra, line) => {
      setup([item(1, status, extra)]);

      const card = await screen.findByRole('article', { name: 'Carlos Lima' });

      const chip = within(card).getByText(label).closest('.MuiChip-root')!;
      expect(chip.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(within(card).getByText(line)).toBeVisible();
      expect(within(card).getByText('Enviada em 02/11/2026')).toBeVisible();
    },
  );

  it('a pendente usa o alerta, a aceita o teal e as demais o neutro, sem o verde de sucesso', async () => {
    setup([
      item(1, 'pending', { expires_at: '2026-11-09T15:00:00Z' }),
      item(2, 'accepted', {
        teacher: { id: 10, full_name: 'Marta Rocha', institute: INSTITUTE },
      }),
      item(3, 'rejected', {
        teacher: { id: 11, full_name: 'Paulo Nunes', institute: INSTITUTE },
      }),
    ]);
    await screen.findByRole('article', { name: 'Carlos Lima' });

    const chip = (label: string) =>
      screen.getByText(label).closest('.MuiChip-root')!;

    expect(chip('Pendente')).toHaveClass('MuiChip-colorWarning');
    expect(chip('Aceita')).toHaveClass('MuiChip-colorPrimary');
    expect(chip('Recusada')).toHaveClass('MuiChip-colorDefault');
    expect(chip('Aceita')).not.toHaveClass('MuiChip-colorSuccess');
  });

  it('a aceita traz a orientação ativa, e a ativa faz o menu ser relido uma só vez', async () => {
    const { fetchMock } = setup(
      [
        item(1, 'accepted', {
          responded_at: '2026-11-04T15:00:00Z',
          advising: {
            id: 3,
            status: 'active',
            started_at: '2026-11-04T15:00:00Z',
            ended_at: null,
          },
        }),
      ],
      {
        request: null,
        advising: {
          id: 3,
          started_at: '2026-11-04T15:00:00Z',
          teacher: { id: 9, full_name: 'Carlos Lima' },
        },
        can_request: false,
        blocked_reason: 'active_advising',
      },
    );

    const card = await screen.findByRole('article', { name: 'Carlos Lima' });

    expect(within(card).getByText('Orientação ativa')).toBeVisible();
    expect(screen.getByText(/Você já tem um orientador ativo/)).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, ME).length).toBeGreaterThanOrEqual(2),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(requestsTo(fetchMock, ME)).toHaveLength(2);
  });

  it('a aceita com a orientação encerrada diz isso e traz o período', async () => {
    setup([
      item(1, 'accepted', {
        responded_at: '2026-03-02T15:00:00Z',
        requested_at: '2026-03-01T15:00:00Z',
        advising: {
          id: 3,
          status: 'ended',
          started_at: '2026-03-02T15:00:00Z',
          ended_at: '2026-10-30T15:00:00Z',
        },
      }),
    ]);

    const card = await screen.findByRole('article', { name: 'Carlos Lima' });

    expect(within(card).getByText('Orientação encerrada')).toBeVisible();
    expect(
      within(card).getByText('Orientação de 02/03/2026 a 30/10/2026'),
    ).toBeVisible();
    expect(
      within(card).queryByText('Orientação ativa'),
    ).not.toBeInTheDocument();
  });

  it('sem o instituto do professor, o cartão não quebra e não mostra a linha', async () => {
    setup([
      item(1, 'rejected', {
        teacher: { id: 9, full_name: 'Carlos Lima', institute: null },
      }),
    ]);

    const card = await screen.findByRole('article', { name: 'Carlos Lima' });

    expect(within(card).queryByText(/Instituto/)).not.toBeInTheDocument();
  });

  it('não derruba a tela diante de um status desconhecido nem de uma data malformada', async () => {
    setup([item(1, 'em_analise', { requested_at: 'lixo' })]);

    const card = await screen.findByRole('article', { name: 'Carlos Lima' });

    expect(within(card).getByText('Situação desconhecida')).toBeVisible();
    expect(within(card).getByText(/data indisponível/)).toBeVisible();
  });
});

describe('StudentRequestPage: elegibilidade no topo', () => {
  it('com permissão para solicitar, oferece o link para buscar orientadores', async () => {
    setup([item(1, 'rejected')], NEVER);

    expect(
      await screen.findByRole('link', { name: 'Buscar orientadores' }),
    ).toHaveAttribute('href', '/aluno/orientadores');
  });

  it('com uma solicitação pendente, explica por que não dá para pedir outra', async () => {
    setup([item(1, 'pending', { expires_at: '2026-11-09T15:00:00Z' })], {
      request: null,
      advising: null,
      can_request: false,
      blocked_reason: 'pending_request',
    });

    expect(
      await screen.findByText(
        /Você já tem uma solicitação aguardando resposta/,
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Buscar orientadores' }),
    ).not.toBeInTheDocument();
  });

  it('o aviso fica abaixo do campo de busca, como na tela de orientadores', async () => {
    setup([item(1, 'pending', { expires_at: '2026-11-09T15:00:00Z' })], {
      request: null,
      advising: null,
      can_request: false,
      blocked_reason: 'pending_request',
    });

    const notice = await screen.findByText(
      /Você já tem uma solicitação aguardando resposta/,
    );
    const search = screen.getByLabelText('Buscar professor');

    expect(
      search.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('avisa, com nova tentativa, quando não consegue saber se pode solicitar', async () => {
    mockApi({
      ...routes([item(1, 'rejected')]),
      [STATUS]: { status: 500, body: {} },
    });
    renderApp('/aluno/solicitacao');

    expect(
      await screen.findByText(
        'Não foi possível verificar se você pode solicitar orientação agora.',
      ),
    ).toBeVisible();
    expect(await screen.findByRole('article')).toBeVisible();
  });
});

describe('StudentRequestPage: busca e paginação (RNF26, RNF30)', () => {
  it('conta as solicitações em uma região de status', async () => {
    setup(many(3));

    await screen.findAllByRole('article');

    expect(screen.getByText('3 solicitações')).toBeVisible();
    expect(
      screen.getByText('3 solicitações').closest('[role="status"]'),
    ).not.toBeNull();
  });

  it('mostra 10 por página e a paginação das outras listas, sem "Exibindo"', async () => {
    const { fetchMock, user } = setup(many(23));
    expect(await screen.findAllByRole('article')).toHaveLength(10);
    expect(screen.getByText('23 solicitações')).toBeVisible();
    expect(screen.queryByText(/Exibindo/)).not.toBeInTheDocument();
    expect(listRequests(fetchMock)[0]).toEqual({ offset: '0', name: null });

    await user.click(
      screen.getByRole('button', { name: 'Ir para a página 3' }),
    );

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
    expect(screen.getByTestId('location')).toHaveTextContent('pagina=3');
    expect(listRequests(fetchMock).at(-1)).toEqual({
      offset: '20',
      name: null,
    });
  });

  it('com até 10 solicitações não mostra a paginação', async () => {
    setup(many(10));
    await screen.findAllByRole('article');

    expect(
      screen.queryByRole('navigation', { name: 'Paginação das solicitações' }),
    ).not.toBeInTheDocument();
  });

  it('abrir direto na página da URL reabre a mesma página', async () => {
    setup(many(23), NEVER, '/aluno/solicitacao?pagina=3');

    expect(await screen.findAllByRole('article')).toHaveLength(3);
    expect(screen.getByText('Professor 21')).toBeVisible();
  });

  it('uma página inexistente volta para a última válida, sem mostrar vazio falso', async () => {
    setup(many(23), NEVER, '/aluno/solicitacao?pagina=9');

    expect(await screen.findByText('Professor 21')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('pagina=3'),
    );
    expect(
      screen.queryByText(/ainda não enviou nenhuma/),
    ).not.toBeInTheDocument();
  });

  it('a busca vai à URL e ao servidor depois da pausa, ignora acentos e volta à primeira página', async () => {
    const items = [
      ...many(12),
      item(99, 'rejected', {
        teacher: {
          id: 200,
          full_name: 'José Antônio Lima',
          institute: INSTITUTE,
        },
      }),
    ];
    const { fetchMock, user } = setup(
      items,
      NEVER,
      '/aluno/solicitacao?pagina=2',
    );
    await screen.findAllByRole('article');

    await user.type(screen.getByLabelText('Buscar professor'), 'jose antonio');

    expect(
      await screen.findByRole('article', { name: 'José Antônio Lima' }),
    ).toBeVisible();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.getByText('1 solicitação encontrada')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      'busca=jose+antonio',
    );
    expect(screen.getByTestId('location')).not.toHaveTextContent('pagina=');
    expect(listRequests(fetchMock).at(-1)).toEqual({
      offset: '0',
      name: 'jose antonio',
    });
  });

  it('uma busca sem resultado diz isso e oferece limpar', async () => {
    const { user } = setup(many(3));
    await screen.findAllByRole('article');

    await user.type(screen.getByLabelText('Buscar professor'), 'zzzz');

    expect(
      await screen.findByText(/Nenhuma solicitação encontrada para essa busca/),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(await screen.findAllByRole('article')).toHaveLength(3);
    expect(screen.getByTestId('location')).not.toHaveTextContent('busca=');
  });

  it('abrir direto numa busca da URL já a aplica', async () => {
    setup(many(12), NEVER, '/aluno/solicitacao?busca=Professor 07');

    expect(
      await screen.findByRole('article', { name: 'Professor 07' }),
    ).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByLabelText('Buscar professor')).toHaveValue(
      'Professor 07',
    );
  });

  it('o link do professor leva junto a origem, e o Voltar do perfil diz de onde veio', async () => {
    const { user } = setup(many(3), NEVER, '/aluno/solicitacao?pagina=1');
    const card = await screen.findByRole('article', { name: 'Professor 01' });

    await user.click(within(card).getByRole('link', { name: 'Professor 01' }));

    expect(
      await screen.findByRole('link', {
        name: 'Voltar para minhas solicitações',
      }),
    ).toHaveAttribute('href', '/aluno/solicitacao?pagina=1');
  });
});

describe('StudentRequestPage: carregamento, erro e releitura', () => {
  it('mostra um esqueleto enquanto carrega', async () => {
    mockApi({
      ...routes([]),
      [LIST]: () => new Promise(() => undefined),
    });
    renderApp('/aluno/solicitacao');

    expect(await screen.findByTestId('request-skeleton')).toBeInTheDocument();
  });

  it('mostra o erro de carregamento e tenta de novo', async () => {
    let failing = true;
    mockApi({
      ...routes([item(1, 'rejected')]),
      [LIST]: () =>
        failing
          ? { status: 500, body: {} }
          : { body: { items: [item(1, 'rejected')], count: 1 } },
    });
    const user = userEvent.setup();
    renderApp('/aluno/solicitacao');

    expect(await screen.findByRole('alert')).toBeVisible();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('article')).toBeVisible();
  });

  it('relê ao voltar para a aba, sem esconder o que já está na tela, e mostra a resposta do professor', async () => {
    let answered = false;
    const fetchMock = mockApi({
      ...routes([]),
      [LIST]: () => ({
        body: {
          items: [
            answered
              ? item(1, 'accepted', { responded_at: '2026-11-04T15:00:00Z' })
              : item(1, 'pending', { expires_at: '2026-11-09T15:00:00Z' }),
          ],
          count: 1,
        },
      }),
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
    expect(requestsTo(fetchMock, LIST).length).toBeGreaterThanOrEqual(2);
  });

  it('mantém o que está na tela quando a releitura falha, mas avisa que pode estar desatualizado e oferece atualizar', async () => {
    let fail = false;
    mockApi({
      ...routes([]),
      [LIST]: () =>
        fail
          ? { status: 500, body: {} }
          : {
              body: {
                items: [
                  item(1, 'pending', { expires_at: '2026-11-09T15:00:00Z' }),
                ],
                count: 1,
              },
            },
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
    const fetchMock = mockApi(routes([item(1, 'rejected')]));
    renderApp('/aluno/solicitacao');
    await screen.findByRole('article');
    const before = requestsTo(fetchMock, LIST).length;

    // No navegador os dois eventos chegam em momentos diferentes, e cada um renderiza sozinho.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(requestsTo(fetchMock, LIST)).toHaveLength(before + 1);
  });
});

describe('StudentRequestPage: celular', () => {
  it('funciona em tela pequena e o link vazio leva à busca de orientadores', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { user } = setup([]);

    await user.click(
      await screen.findByRole('link', { name: 'Buscar orientadores' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Orientadores' }),
    ).toBeInTheDocument();
  });
});
