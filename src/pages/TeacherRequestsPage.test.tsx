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

type User = ReturnType<typeof userEvent.setup>;

const situationBox = () => screen.getByRole('combobox', { name: 'Situação' });

/** O dropdown de Situação: abre a lista e escolhe a opção. */
async function chooseSituation(user: User, label: string) {
  await user.click(situationBox());
  await user.click(await screen.findByRole('option', { name: label }));
}

const MIXED = [
  makeRequest(1, 'pending', {
    student: {
      id: 101,
      full_name: 'Ana Souza',
      course: { id: 10, name: 'Ciência da Computação' },
      areas: [
        { id: 1, name: 'Banco de Dados', is_common: true },
        { id: 2, name: 'Inteligência Artificial', is_common: false },
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

    expect(situationBox()).toHaveTextContent('Pendentes');
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
    expect(within(ana).getByText('Enviada em 02/11/2026')).toBeVisible();
    expect(within(ana).getByText('Pendente')).toBeVisible();
    expect(
      within(ana).getByText('Pode ser respondida até 09/11/2026'),
    ).toBeVisible();
  });

  it('mostra as solicitações na ordem em que a API as devolve', async () => {
    setup([makeRequest(7), makeRequest(3), makeRequest(5)]);
    await screen.findByText('Aluno 7');

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Aluno 7', 'Aluno 3', 'Aluno 5']);
  });

  it('não mostra e-mail nem matrícula, e o único link do cartão é o do nome, para o perfil do aluno', async () => {
    setup();
    await screen.findByText('Ana Souza');

    const ana = cardOf('Ana Souza');

    expect(within(ana).getAllByRole('link')).toHaveLength(1);
    expect(
      within(ana).getByRole('link', { name: 'Ana Souza' }),
    ).toHaveAttribute('href', '/professor/alunos/101');
    expect(ana.textContent).not.toMatch(/@|Matrícula/);
  });

  it('oferece as cinco situações e manda cada uma ao servidor, "Todas" sem o parâmetro', async () => {
    const { fetchMock, user } = setup();
    await screen.findByText('Ana Souza');
    await user.click(situationBox());
    const labels = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    await user.keyboard('{Escape}');
    expect(labels).toEqual([
      'Pendentes',
      'Todas',
      'Aceitas',
      'Recusadas',
      'Não respondidas',
    ]);

    await chooseSituation(user, 'Todas');
    await screen.findByText('Aluno 2');
    await chooseSituation(user, 'Aceitas');
    await waitFor(() =>
      expect(statusParams(fetchMock).at(-1)?.status).toBe('accepted'),
    );
    await chooseSituation(user, 'Recusadas');
    await waitFor(() =>
      expect(statusParams(fetchMock).at(-1)?.status).toBe('rejected'),
    );
    await chooseSituation(user, 'Não respondidas');
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
    await chooseSituation(user, 'Todas');
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

  it('as respondidas e a vencida dizem, em texto visível, as datas e que não têm botões', async () => {
    const { user } = setup();
    await screen.findByText('Ana Souza');
    await chooseSituation(user, 'Todas');
    await screen.findByText('Aluno 2');

    expect(
      within(cardOf('Aluno 2')).getByText('Aceita em 03/11/2026'),
    ).toBeVisible();
    expect(
      within(cardOf('Aluno 3')).getByText('Recusada em 03/11/2026'),
    ).toBeVisible();
    expect(
      within(cardOf('Aluno 4')).getByText('Prazo encerrado sem resposta'),
    ).toBeVisible();
    for (const name of ['Aluno 2', 'Aluno 3', 'Aluno 4']) {
      expect(
        within(cardOf(name)).queryByRole('button'),
      ).not.toBeInTheDocument();
    }
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
    expect(within(card).getByText('Aceita em 04/11/2026')).toBeVisible();
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

    await chooseSituation(user, 'Aceitas');

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
      await screen.findByRole('combobox', { name: 'Situação' });
      await chooseSituation(user, label);

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
    expect(situationBox()).toHaveTextContent('Aceitas');
    expect(
      screen.getByRole('button', { name: 'Página 2, atual' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('trocar o filtro guarda a situação na URL e volta à página 1', async () => {
    const { user } = open('/professor/solicitacoes?pagina=2');
    await screen.findByText('Aluno 21');

    await chooseSituation(user, 'Aceitas');

    await screen.findByText('Aluno 100');
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/solicitacoes\?situacao=accepted$/,
    );
  });

  it('"Pendentes", que é o padrão, não põe nada na URL', async () => {
    const { user } = open('/professor/solicitacoes?situacao=accepted');
    await screen.findByText('Aluno 100');

    await chooseSituation(user, 'Pendentes');

    await screen.findByText('Aluno 1');
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/solicitacoes$/,
    );
  });

  it('"Todas" fica na URL e vai ao servidor sem o parâmetro de situação', async () => {
    const { fetchMock, user } = open('/professor/solicitacoes');
    await screen.findByText('Aluno 1');

    await chooseSituation(user, 'Todas');

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
      expect(situationBox()).toHaveTextContent('Pendentes');
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

function nameParams(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, LIST).map(([input]) => {
    const params = new URL(String(input), 'http://localhost').searchParams;
    return {
      status: params.get('status'),
      name: params.get('name'),
      offset: params.get('offset'),
    };
  });
}

const NAMED = [
  makeRequest(1, 'pending', {
    student: {
      id: 101,
      full_name: 'José Antônio Lima',
      course: { id: 10, name: 'Ciência da Computação' },
      areas: [],
    },
  }),
  makeRequest(2, 'pending', {
    student: {
      id: 102,
      full_name: 'Marta Rocha',
      course: { id: 10, name: 'Ciência da Computação' },
      areas: [],
    },
  }),
  makeRequest(3, 'accepted', {
    student: {
      id: 103,
      full_name: 'Jose Carlos',
      course: { id: 10, name: 'Ciência da Computação' },
      areas: [],
    },
  }),
];

describe('TeacherRequestsPage: busca por aluno e dropdown de situação', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('mostra a busca e o dropdown na mesma linha, sem botões de opção', async () => {
    setup(NAMED);
    await screen.findByText('José Antônio Lima');

    const search = screen.getByLabelText('Buscar aluno');
    const select = situationBox();

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(search.closest('.MuiStack-root')).toBe(
      select.closest('.MuiStack-root'),
    );
    expect(
      search.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('empilha a busca e o dropdown no celular', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup(NAMED);
    await screen.findByText('José Antônio Lima');

    expect(screen.getByLabelText('Buscar aluno')).toBeVisible();
    expect(situationBox()).toBeVisible();
  });

  it('o título ganha a frase de apoio', async () => {
    setup(NAMED);

    expect(
      await screen.findByText(
        'Responda às solicitações de orientação dos seus alunos.',
      ),
    ).toBeVisible();
  });

  it('a busca vai ao servidor depois da pausa, sem acento, e à URL, e volta à primeira página', async () => {
    const { fetchMock, user } = setup(NAMED);
    await screen.findByText('José Antônio Lima');

    await user.type(screen.getByLabelText('Buscar aluno'), 'jose antonio');

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(cardOf('José Antônio Lima')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('busca=jose');
    expect(screen.getByTestId('location')).not.toHaveTextContent('pagina=');
    expect(nameParams(fetchMock).at(-1)).toEqual({
      status: 'pending',
      name: 'jose antonio',
      offset: '0',
    });
  });

  it('a busca e a situação combinam', async () => {
    const { user } = setup(NAMED);
    await screen.findByText('José Antônio Lima');

    await chooseSituation(user, 'Todas');
    await user.type(screen.getByLabelText('Buscar aluno'), 'jose');

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    await chooseSituation(user, 'Aceitas');

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(cardOf('Jose Carlos')).toBeVisible();
  });

  it('abrir direto numa busca da URL já a aplica', async () => {
    mockApi(requestRoutes(NAMED));
    renderApp('/professor/solicitacoes?busca=marta');

    expect(await findCard('Marta Rocha')).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByLabelText('Buscar aluno')).toHaveValue('marta');
  });

  it('uma busca sem resultado diz isso e oferece limpar', async () => {
    const { user } = setup(NAMED);
    await screen.findByText('José Antônio Lima');

    await user.type(screen.getByLabelText('Buscar aluno'), 'zzzz');

    expect(
      await screen.findByText(/Nenhuma solicitação encontrada para essa busca/),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(screen.getByTestId('location')).not.toHaveTextContent('busca=');
  });

  it('o total fica só para leitor de tela', async () => {
    setup(NAMED);
    await screen.findByText('José Antônio Lima');

    const total = screen.getByText('2 solicitações encontradas');

    expect(total.closest('[role="status"]')).not.toBeNull();
  });

  it('o cartão usa o padrão do aluno: nome em h3, chip colorido e datas curtas', async () => {
    const { user } = setup(NAMED);
    await screen.findByText('José Antônio Lima');
    await chooseSituation(user, 'Todas');
    await findCard('Jose Carlos');

    expect(
      screen.getByRole('heading', { level: 2, name: 'José Antônio Lima' }),
    ).toBeVisible();
    expect(
      screen.getAllByText('Pendente')[0]!.closest('.MuiChip-root'),
    ).toHaveClass('MuiChip-colorWarning');
    expect(screen.getByText('Aceita').closest('.MuiChip-root')).toHaveClass(
      'MuiChip-colorPrimary',
    );
    expect(cardOf('Jose Carlos')).not.toHaveClass('MuiPaper-outlined');
  });
});

describe('TeacherRequestsPage: áreas em comum', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  const ONE = [
    makeRequest(1, 'pending', {
      student: {
        id: 101,
        full_name: 'Ana Souza',
        course: { id: 10, name: 'Ciência da Computação' },
        areas: [
          { id: 2, name: 'Redes', is_common: true },
          { id: 3, name: 'Banco de Dados', is_common: true },
          { id: 1, name: 'Algoritmos', is_common: false },
        ],
      },
    }),
  ];

  it('destaca as áreas em comum como no perfil: verdes, preenchidas e com sinal de certo', async () => {
    setup(ONE);
    const card = await findCard('Ana Souza');

    const redes = within(card)
      .getByText(/^Redes/)
      .closest('.MuiChip-root')!;
    const algoritmos = within(card)
      .getByText('Algoritmos')
      .closest('.MuiChip-root')!;

    expect(redes).toHaveClass('MuiChip-colorSuccess', 'MuiChip-filled');
    expect(redes.querySelector('svg')).not.toBeNull();
    expect(algoritmos).toHaveClass('MuiChip-outlined');
    expect(algoritmos).not.toHaveClass('MuiChip-colorSuccess');
  });

  it('mantém a ordem que o servidor mandou, com as em comum primeiro', async () => {
    setup(ONE);
    const card = await findCard('Ana Souza');

    const areas = within(card).getByRole('list', {
      name: 'Áreas de interesse de Ana Souza',
    });
    const names = within(areas)
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(names).toEqual([
      'Redes, em comum',
      'Banco de Dados, em comum',
      'Algoritmos',
    ]);
  });

  it('o leitor de tela ouve "em comum" no nome e a contagem de áreas em comum', async () => {
    setup(ONE);
    const card = await findCard('Ana Souza');

    const list = within(card).getByRole('list', {
      name: 'Áreas de interesse de Ana Souza',
    });
    expect(list).toHaveAccessibleDescription('2 áreas em comum');
  });

  it('sem nenhuma em comum, anuncia isso e não destaca nada', async () => {
    setup([
      makeRequest(1, 'pending', {
        student: {
          id: 101,
          full_name: 'Ana Souza',
          course: { id: 10, name: 'Ciência da Computação' },
          areas: [{ id: 1, name: 'Algoritmos', is_common: false }],
        },
      }),
    ]);
    const card = await findCard('Ana Souza');

    expect(
      within(card).getByRole('list', {
        name: 'Áreas de interesse de Ana Souza',
      }),
    ).toHaveAccessibleDescription('Nenhuma área em comum');
    expect(card.querySelector('.MuiChip-colorSuccess')).toBeNull();
  });

  it('o aluno sem áreas não mostra a seção de áreas', async () => {
    setup([
      makeRequest(1, 'pending', {
        student: {
          id: 101,
          full_name: 'Ana Souza',
          course: { id: 10, name: 'Ciência da Computação' },
          areas: [],
        },
      }),
    ]);
    const card = await findCard('Ana Souza');

    expect(
      within(card).queryByRole('list', {
        name: 'Áreas de interesse de Ana Souza',
      }),
    ).not.toBeInTheDocument();
  });

  it('depois de aceitar, o cartão continua com as áreas em comum destacadas', async () => {
    const { user } = setup(ONE);
    await findCard('Ana Souza');
    await user.click(
      within(cardOf('Ana Souza')).getByRole('button', { name: 'Aceitar' }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Aceitar',
      }),
    );

    const card = await findCard('Ana Souza');
    expect(await within(card).findByText('Aceita')).toBeVisible();
    expect(card.querySelector('.MuiChip-colorSuccess')).not.toBeNull();
  });
});
