import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { makeRequest, requestRoutes } from '../test/teacherRequestsApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/orientacao/solicitacoes';

function cardOf(name: string) {
  return screen.getByRole('article', { name });
}

/** Com o diálogo aberto ou saindo, o resto da página fica fora da árvore de acessibilidade. */
function findCard(name: string) {
  return screen.findByRole('article', { name });
}

function statusParams(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, LIST).map(([input]) => {
    const params = new URL(String(input), 'http://localhost').searchParams;
    return {
      status: params.get('status'),
      limit: params.get('limit'),
      offset: params.get('offset'),
    };
  });
}

const MIXED = [
  makeRequest(1, 'pending', {
    student: {
      id: 101,
      full_name: 'Ana Souza',
      course: { id: 10, name: 'Ciência da Computação' },
      areas: [
        { id: 1, name: 'Banco de Dados' },
        { id: 2, name: 'Inteligência Artificial' },
      ],
    },
  }),
  makeRequest(2, 'accepted'),
  makeRequest(3, 'rejected'),
  makeRequest(4, 'unanswered'),
];

function setup(items = MIXED) {
  const fetchMock = mockApi(requestRoutes(items));
  const user = userEvent.setup();
  renderApp('/professor/solicitacoes');
  return { fetchMock, user };
}

describe('TeacherRequestsPage: a lista e o filtro', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('abre em "Pendentes", pedindo só as pendentes ao servidor', async () => {
    const { fetchMock } = setup();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Solicitações' }),
    ).toBeInTheDocument();
    await screen.findByText('Ana Souza');

    expect(screen.getByRole('radio', { name: 'Pendentes' })).toBeChecked();
    expect(statusParams(fetchMock)).toEqual([
      { status: 'pending', limit: '20', offset: '0' },
    ]);
    expect(screen.queryByText('Aluno 2')).not.toBeInTheDocument();
  });

  it('mostra o aluno com curso e áreas, a data de envio, o status em texto e o prazo da pendente', async () => {
    setup();
    await screen.findByText('Ana Souza');

    const ana = cardOf('Ana Souza');
    expect(within(ana).getByText('Ciência da Computação')).toBeVisible();
    expect(within(ana).getByText('Banco de Dados')).toBeVisible();
    expect(within(ana).getByText('Inteligência Artificial')).toBeVisible();
    expect(
      within(ana).getByText('Enviada em 2 de novembro de 2026'),
    ).toBeVisible();
    expect(within(ana).getByText('Pendente')).toBeVisible();
    expect(
      within(ana).getByText(
        'Prazo para responder: 9 de novembro de 2026, às 11:30.',
      ),
    ).toBeVisible();
  });

  it('mostra as solicitações na ordem em que a API as devolve', async () => {
    setup([makeRequest(7), makeRequest(3), makeRequest(5)]);
    await screen.findByText('Aluno 7');

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Aluno 7', 'Aluno 3', 'Aluno 5']);
  });

  it('não mostra e-mail, matrícula nem link para o perfil do aluno', async () => {
    setup();
    await screen.findByText('Ana Souza');

    const ana = cardOf('Ana Souza');

    expect(within(ana).queryByRole('link')).not.toBeInTheDocument();
    expect(ana.textContent).not.toMatch(/@/);
  });

  it('oferece as cinco situações e manda cada uma ao servidor, "Todas" sem o parâmetro', async () => {
    const { fetchMock, user } = setup();
    await screen.findByText('Ana Souza');
    const labels = screen
      .getAllByRole('radio')
      .map(
        (radio) =>
          radio.getAttribute('aria-label') ??
          radio.closest('label')?.textContent,
      );
    expect(labels).toEqual([
      'Pendentes',
      'Todas',
      'Aceitas',
      'Recusadas',
      'Não respondidas',
    ]);

    await user.click(screen.getByRole('radio', { name: 'Todas' }));
    await screen.findByText('Aluno 2');
    await user.click(screen.getByRole('radio', { name: 'Aceitas' }));
    await waitFor(() =>
      expect(statusParams(fetchMock).at(-1)?.status).toBe('accepted'),
    );
    await user.click(screen.getByRole('radio', { name: 'Recusadas' }));
    await waitFor(() =>
      expect(statusParams(fetchMock).at(-1)?.status).toBe('rejected'),
    );
    await user.click(screen.getByRole('radio', { name: 'Não respondidas' }));
    await waitFor(() =>
      expect(statusParams(fetchMock).at(-1)?.status).toBe('unanswered'),
    );

    expect(statusParams(fetchMock).map((p) => p.status)).toEqual([
      'pending',
      null,
      'accepted',
      'rejected',
      'unanswered',
    ]);
  });
});

describe('TeacherRequestsPage: as ações conforme a situação', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('só a pendente mostra Aceitar e Recusar', async () => {
    const { user } = setup();
    await screen.findByText('Ana Souza');
    await user.click(screen.getByRole('radio', { name: 'Todas' }));
    await screen.findByText('Aluno 2');

    expect(
      within(cardOf('Ana Souza')).getByRole('button', { name: 'Aceitar' }),
    ).toBeEnabled();
    expect(
      within(cardOf('Ana Souza')).getByRole('button', { name: 'Recusar' }),
    ).toBeEnabled();
    for (const name of ['Aluno 2', 'Aluno 3', 'Aluno 4']) {
      expect(
        within(cardOf(name)).queryByRole('button'),
      ).not.toBeInTheDocument();
    }
  });

  it('as respondidas e a vencida dizem, em texto visível, por que não têm botões', async () => {
    const { user } = setup();
    await screen.findByText('Ana Souza');
    await user.click(screen.getByRole('radio', { name: 'Todas' }));
    await screen.findByText('Aluno 2');

    for (const name of ['Aluno 2', 'Aluno 3']) {
      expect(
        within(cardOf(name)).getByText(
          'Esta solicitação já foi respondida e não pode ser alterada.',
        ),
      ).toBeVisible();
    }
    expect(
      within(cardOf('Aluno 3')).getByText(
        'Respondida em 3 de novembro de 2026',
      ),
    ).toBeVisible();
    expect(
      within(cardOf('Aluno 4')).getByText(
        'O prazo para responder acabou, e a solicitação não pode mais ser respondida.',
      ),
    ).toBeVisible();
  });
});

const ME = 'GET /api/auth/me';
const ANSWER_1 = 'POST /api/orientacao/solicitacoes/1/responder';

async function openDialog(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  action: 'Aceitar' | 'Recusar',
) {
  await screen.findByText(name);
  const button = within(cardOf(name)).getByRole('button', { name: action });
  await user.click(button);
  return { button, dialog: await screen.findByRole('dialog') };
}

describe('TeacherRequestsPage: confirmar e responder', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('pede confirmação para recusar, explica que o aluno é avisado e que não há motivo, e devolve o foco ao cancelar', async () => {
    const { fetchMock, user } = setup();
    const { button, dialog } = await openDialog(user, 'Ana Souza', 'Recusar');

    expect(dialog).toHaveAccessibleName('Recusar a solicitação de Ana Souza?');
    expect(dialog).toHaveTextContent('O aluno será avisado da recusa');
    expect(dialog).toHaveTextContent('Não é preciso informar um motivo');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, ANSWER_1)).toHaveLength(0);
    expect(button).toHaveFocus();
  });

  it('pede confirmação para aceitar e explica que isso cria a orientação ativa', async () => {
    const { user } = setup();
    const { dialog } = await openDialog(user, 'Ana Souza', 'Aceitar');

    expect(dialog).toHaveAccessibleName('Aceitar a solicitação de Ana Souza?');
    expect(dialog).toHaveTextContent(
      'Aceitar cria a orientação ativa com este aluno',
    );
  });

  it('ao confirmar, envia a ação certa e atualiza o item com a resposta do servidor, sem atualização otimista', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = requestRoutes(MIXED);
    const answer = base[ANSWER_1] as (body: unknown, url: URL) => unknown;
    const fetchMock = mockApi({
      ...base,
      [ANSWER_1]: async (body: unknown, url: URL) => {
        await gate;
        return answer(body, url);
      },
    } as never);
    const user = userEvent.setup();
    renderApp('/professor/solicitacoes');
    const { dialog } = await openDialog(user, 'Ana Souza', 'Aceitar');

    await user.click(within(dialog).getByRole('button', { name: 'Aceitar' }));

    const busy = await within(dialog).findByRole('button', {
      name: 'Enviando…',
    });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(requestsTo(fetchMock, ANSWER_1)).toHaveLength(1);
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    release?.();

    const card = await findCard('Ana Souza');
    expect(await within(card).findByText('Aceita')).toBeVisible();
    expect(
      within(card).getByText('Respondida em 4 de novembro de 2026'),
    ).toBeVisible();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    expect(
      JSON.parse(String(requestsTo(fetchMock, ANSWER_1)[0]?.[1]?.body)),
    ).toEqual({ action: 'accept' });
    expect(await screen.findByText('Solicitação aceita.')).toBeVisible();
  });

  it('depois de responder, leva o foco ao cartão da solicitação, porque o botão usado deixou de existir', async () => {
    const { user } = setup();
    const { dialog } = await openDialog(user, 'Ana Souza', 'Recusar');

    await user.click(within(dialog).getByRole('button', { name: 'Recusar' }));

    const card = await findCard('Ana Souza');
    await within(card).findByText('Recusada');
    await waitFor(() => expect(card).toHaveFocus());
  });

  it('depois de aceitar, relê o usuário para o menu saber dos orientandos', async () => {
    const { fetchMock, user } = setup();
    const { dialog } = await openDialog(user, 'Ana Souza', 'Aceitar');

    await user.click(within(dialog).getByRole('button', { name: 'Aceitar' }));

    await waitFor(() => expect(requestsTo(fetchMock, ME)).toHaveLength(2));
  });

  it('depois de aceitar, o item Orientandos do menu passa de desabilitado a link, sem recarregar a página', async () => {
    let advisees = 0;
    const base = requestRoutes(MIXED);
    const answer = base[ANSWER_1] as (body: unknown, url: URL) => unknown;
    mockApi({
      ...base,
      [ME]: () => ({
        body: {
          id: 9,
          full_name: 'Carlos Lima',
          email: 'carlos@example.com',
          type: 'teacher',
          active_advisees_count: advisees,
        },
      }),
      [ANSWER_1]: (body: unknown, url: URL) => {
        advisees = 1;
        return answer(body, url);
      },
    } as never);
    const user = userEvent.setup();
    renderApp('/professor/solicitacoes');
    expect(
      await screen.findByRole('button', { name: /Orientandos/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    const { dialog } = await openDialog(user, 'Ana Souza', 'Aceitar');

    await user.click(within(dialog).getByRole('button', { name: 'Aceitar' }));

    expect(
      await screen.findByRole('link', { name: 'Orientandos' }),
    ).toHaveAttribute('href', '/professor/orientandos');
    expect(
      screen.queryByRole('button', { name: /Orientandos/ }),
    ).not.toBeInTheDocument();
  });

  it('depois de recusar, mostra o aviso e não relê o usuário', async () => {
    const { fetchMock, user } = setup();
    const { dialog } = await openDialog(user, 'Ana Souza', 'Recusar');

    await user.click(within(dialog).getByRole('button', { name: 'Recusar' }));

    expect(await screen.findByText('Solicitação recusada.')).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(requestsTo(fetchMock, ME)).toHaveLength(1);
  });

  it('no 409, mostra a mensagem da API, fecha o diálogo e recarrega a lista', async () => {
    const fetchMock = mockApi(
      requestRoutes(MIXED, {
        1: {
          status: 409,
          body: { detail: 'Esta solicitação já foi respondida.' },
        },
      }),
    );
    const user = userEvent.setup();
    renderApp('/professor/solicitacoes');
    const { dialog } = await openDialog(user, 'Ana Souza', 'Aceitar');
    expect(requestsTo(fetchMock, LIST)).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: 'Aceitar' }));

    expect(
      await screen.findByText('Esta solicitação já foi respondida.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(requestsTo(fetchMock, LIST)).toHaveLength(2));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Solicitações' }),
    ).toBeInTheDocument();
  });

  it('no 404, recarrega a lista; em outras falhas, mostra o erro e mantém a tela', async () => {
    const fetchMock = mockApi(
      requestRoutes([makeRequest(1, 'pending'), makeRequest(7, 'pending')], {
        1: { status: 404, body: { detail: 'Solicitação não encontrada.' } },
        7: { status: 500, body: {} },
      }),
    );
    const user = userEvent.setup();
    renderApp('/professor/solicitacoes');
    const missing = await openDialog(user, 'Aluno 1', 'Aceitar');

    await user.click(
      within(missing.dialog).getByRole('button', { name: 'Aceitar' }),
    );

    await waitFor(() => expect(requestsTo(fetchMock, LIST)).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    const failing = await openDialog(user, 'Aluno 7', 'Recusar');
    await user.click(
      within(failing.dialog).getByRole('button', { name: 'Recusar' }),
    );

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(cardOf('Aluno 7')).toBeInTheDocument();
    expect(requestsTo(fetchMock, LIST)).toHaveLength(2);
  });
});

const FORTY_FIVE = Array.from({ length: 45 }, (_, index) =>
  makeRequest(index + 1, 'pending'),
);

describe('TeacherRequestsPage: paginação', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('pede 20 por vez e mostra a navegação numerada, uma página para cada 20', async () => {
    mockApi(requestRoutes(FORTY_FIVE));
    renderApp('/professor/solicitacoes');
    await screen.findByText('Aluno 1');

    const pages = screen.getByRole('navigation', {
      name: 'Paginação das solicitações',
    });

    expect(screen.getAllByRole('article')).toHaveLength(20);
    expect(
      within(pages).getAllByRole('button', { name: /^Ir para a página \d+$/ }),
    ).toHaveLength(2);
    expect(
      within(pages).getByRole('button', { name: 'Página 1, atual' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('45 solicitações encontradas')).toBeVisible();
  });

  it('muda de página, pede o deslocamento certo e rola até o topo da lista', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const fetchMock = mockApi(requestRoutes(FORTY_FIVE));
    const user = userEvent.setup();
    renderApp('/professor/solicitacoes');
    await screen.findByText('Aluno 1');

    await user.click(
      screen.getByRole('button', { name: 'Ir para a página 3' }),
    );

    expect(await screen.findByText('Aluno 41')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(statusParams(fetchMock).at(-1)).toEqual({
      status: 'pending',
      limit: '20',
      offset: '40',
    });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('mantém o filtro ao trocar de página e volta à página 1 quando o filtro muda', async () => {
    const items = [
      ...FORTY_FIVE,
      ...Array.from({ length: 25 }, (_, index) =>
        makeRequest(100 + index, 'accepted'),
      ),
    ];
    const fetchMock = mockApi(requestRoutes(items));
    const user = userEvent.setup();
    renderApp('/professor/solicitacoes');
    await screen.findByText('Aluno 1');
    await user.click(
      screen.getByRole('button', { name: 'Ir para a página 2' }),
    );
    await screen.findByText('Aluno 21');
    expect(statusParams(fetchMock).at(-1)).toMatchObject({
      status: 'pending',
      offset: '20',
    });

    await user.click(screen.getByRole('radio', { name: 'Aceitas' }));

    await screen.findByText('Aluno 100');
    expect(statusParams(fetchMock).at(-1)).toEqual({
      status: 'accepted',
      limit: '20',
      offset: '0',
    });
  });

  it('não mostra a paginação quando tudo cabe em uma página', async () => {
    setup();
    await screen.findByText('Ana Souza');

    expect(
      screen.queryByRole('navigation', { name: 'Paginação das solicitações' }),
    ).not.toBeInTheDocument();
  });
});

describe('TeacherRequestsPage: estados', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('mostra um esqueleto enquanto a lista carrega', async () => {
    mockApi({
      ...requestRoutes(MIXED),
      [LIST]: () => new Promise(() => undefined),
    });

    renderApp('/professor/solicitacoes');

    expect(await screen.findByTestId('requests-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('mostra o erro de carregamento e tenta de novo', async () => {
    let attempts = 0;
    mockApi({
      ...requestRoutes(MIXED),
      [LIST]: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: {} }
          : { body: { items: [], count: 0 } };
      },
    });
    const user = userEvent.setup();
    renderApp('/professor/solicitacoes');

    await user.click(
      await screen.findByRole('button', { name: 'Tentar novamente' }),
    );

    expect(
      await screen.findByText('Nenhuma solicitação pendente.'),
    ).toBeVisible();
    expect(attempts).toBe(2);
  });

  it.each([
    ['Pendentes', 'Nenhuma solicitação pendente.'],
    ['Todas', 'Você ainda não recebeu nenhuma solicitação.'],
    ['Aceitas', 'Nenhuma solicitação aceita.'],
    ['Recusadas', 'Nenhuma solicitação recusada.'],
    ['Não respondidas', 'Nenhuma solicitação não respondida.'],
  ])(
    'com o filtro "%s" sem resultados, explica o vazio',
    async (label, message) => {
      mockApi(requestRoutes([]));
      const user = userEvent.setup();
      renderApp('/professor/solicitacoes');
      await screen.findByRole('radio', { name: 'Pendentes' });
      await user.click(screen.getByRole('radio', { name: label }));

      expect(await screen.findByText(message)).toBeVisible();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    },
  );

  it('funciona em tela pequena: menu recolhido, filtro visível, diálogo e resposta', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { fetchMock, user } = setup();
    expect(
      await screen.findByRole('button', { name: 'Abrir menu' }),
    ).toBeInTheDocument();
    await screen.findByText('Ana Souza');
    expect(screen.getByText('Pendentes')).toBeVisible();

    const { dialog } = await openDialog(user, 'Ana Souza', 'Aceitar');
    await user.click(within(dialog).getByRole('button', { name: 'Aceitar' }));

    expect(await screen.findByText('Solicitação aceita.')).toBeVisible();
    expect(requestsTo(fetchMock, ANSWER_1)).toHaveLength(1);
  });
});

describe('TeacherRequestsPage: filtro e página na URL', () => {
  const ITEMS = [
    ...Array.from({ length: 45 }, (_, index) =>
      makeRequest(index + 1, 'pending'),
    ),
    ...Array.from({ length: 25 }, (_, index) =>
      makeRequest(100 + index, 'accepted'),
    ),
  ];

  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  function open(path: string) {
    const fetchMock = mockApi(requestRoutes(ITEMS));
    const user = userEvent.setup();
    renderApp(path);
    return { fetchMock, user };
  }

  it('abre direto no filtro e na página da URL, como ao recarregar ou voltar de outra tela', async () => {
    const { fetchMock } = open(
      '/professor/solicitacoes?situacao=accepted&pagina=2',
    );

    expect(await screen.findByText('Aluno 120')).toBeInTheDocument();

    expect(statusParams(fetchMock)).toEqual([
      { status: 'accepted', limit: '20', offset: '20' },
    ]);
    expect(screen.getByRole('radio', { name: 'Aceitas' })).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Página 2, atual' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('trocar o filtro guarda a situação na URL e volta à página 1', async () => {
    const { user } = open('/professor/solicitacoes?pagina=2');
    await screen.findByText('Aluno 21');

    await user.click(screen.getByRole('radio', { name: 'Aceitas' }));

    await screen.findByText('Aluno 100');
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/solicitacoes\?situacao=accepted$/,
    );
  });

  it('"Pendentes", que é o padrão, não põe nada na URL', async () => {
    const { user } = open('/professor/solicitacoes?situacao=accepted');
    await screen.findByText('Aluno 100');

    await user.click(screen.getByRole('radio', { name: 'Pendentes' }));

    await screen.findByText('Aluno 1');
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/solicitacoes$/,
    );
  });

  it('"Todas" fica na URL e vai ao servidor sem o parâmetro de situação', async () => {
    const { fetchMock, user } = open('/professor/solicitacoes');
    await screen.findByText('Aluno 1');

    await user.click(screen.getByRole('radio', { name: 'Todas' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('situacao=all'),
    );
    await waitFor(() =>
      expect(statusParams(fetchMock).at(-1)?.status).toBeNull(),
    );
  });

  it('mudar de página guarda a página na URL e mantém o filtro', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { user } = open('/professor/solicitacoes?situacao=accepted');
    await screen.findByText('Aluno 100');

    await user.click(
      screen.getByRole('button', { name: 'Ir para a página 2' }),
    );

    await screen.findByText('Aluno 120');
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/solicitacoes\?situacao=accepted&pagina=2$/,
    );
  });

  it.each(['foo', '', 'ACCEPTED'])(
    'uma situação inválida ("%s") na URL vale como "Pendentes"',
    async (value) => {
      const { fetchMock } = open(`/professor/solicitacoes?situacao=${value}`);

      expect(await screen.findByText('Aluno 1')).toBeInTheDocument();

      expect(statusParams(fetchMock)[0]?.status).toBe('pending');
      expect(screen.getByRole('radio', { name: 'Pendentes' })).toBeChecked();
    },
  );

  it.each(['abc', '0', '-2'])(
    'uma página inválida ("%s") na URL vale como a primeira',
    async (value) => {
      const { fetchMock } = open(`/professor/solicitacoes?pagina=${value}`);

      expect(await screen.findByText('Aluno 1')).toBeInTheDocument();

      expect(statusParams(fetchMock)[0]).toEqual({
        status: 'pending',
        limit: '20',
        offset: '0',
      });
    },
  );

  it('uma página além da última volta para a última que existe, sem entrar no histórico', async () => {
    const { fetchMock } = open(
      '/professor/solicitacoes?situacao=accepted&pagina=9',
    );

    expect(await screen.findByText('Aluno 120')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('pagina=2'),
    );
    expect(statusParams(fetchMock).at(-1)).toEqual({
      status: 'accepted',
      limit: '20',
      offset: '20',
    });
  });
});
