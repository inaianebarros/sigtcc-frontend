import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { adviseeRoutes, makeAdvisee } from '../test/adviseesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/orientacao/orientandos';
const PATH = '/professor/orientandos';

function cardOf(name: string) {
  return screen.getByRole('article', { name });
}

function listParams(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, LIST).map(([input]) => {
    const params = new URL(String(input), 'http://localhost').searchParams;
    return { limit: params.get('limit'), offset: params.get('offset') };
  });
}

function setup(items = [makeAdvisee(1), makeAdvisee(2)], path = PATH) {
  const fetchMock = mockApi(adviseeRoutes(items));
  const user = userEvent.setup();
  renderApp(path);
  return { fetchMock, user };
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('TeacherAdviseesPage: a lista e o cartão', () => {
  it('abre em /professor/orientandos com o título e um cartão por orientando, na ordem da API', async () => {
    setup([makeAdvisee(7), makeAdvisee(3), makeAdvisee(5)]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Orientandos' }),
    ).toBeInTheDocument();
    await screen.findByText('Orientando 7');

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Orientando 7', 'Orientando 3', 'Orientando 5']);
    expect(screen.getByText('3 orientandos encontrados')).toBeVisible();
  });

  it('mostra no cartão o nome, o curso, o início, o tema e as quatro contagens em texto rotulado', async () => {
    setup([
      makeAdvisee(1, {
        student: {
          id: 101,
          full_name: 'Ana Souza',
          course: { id: 10, name: 'Sistemas de Informação' },
        },
        thesis_topic: 'Aprendizado de máquina na saúde',
        activities: { pending: 5, in_progress: 6, in_review: 7, completed: 8 },
      }),
    ]);
    await screen.findByText('Ana Souza');

    const card = cardOf('Ana Souza');

    expect(within(card).getByText('Sistemas de Informação')).toBeVisible();
    expect(
      within(card).getByText('Orientação iniciada em 2 de novembro de 2026'),
    ).toBeVisible();
    expect(
      within(card).getByText('Tema: Aprendizado de máquina na saúde'),
    ).toBeVisible();
    const counts = within(card).getByRole('list', {
      name: 'Atividades por status',
    });
    expect(
      within(counts)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Pendente: 5',
      'Em andamento: 6',
      'Em revisão: 7',
      'Concluída: 8',
    ]);
  });

  it('diz "Tema não cadastrado" quando o orientando não tem tema', async () => {
    setup([makeAdvisee(1, { thesis_topic: null })]);
    await screen.findByText('Orientando 1');

    expect(
      within(cardOf('Orientando 1')).getByText('Tema não cadastrado'),
    ).toBeVisible();
  });

  it('mostra as contagens zeradas como 0, sem esconder o status', async () => {
    setup([
      makeAdvisee(1, {
        activities: { pending: 0, in_progress: 0, in_review: 0, completed: 0 },
      }),
    ]);
    await screen.findByText('Orientando 1');

    const counts = within(cardOf('Orientando 1')).getByRole('list', {
      name: 'Atividades por status',
    });

    expect(
      within(counts)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Pendente: 0',
      'Em andamento: 0',
      'Em revisão: 0',
      'Concluída: 0',
    ]);
  });

  it('não mostra e-mail nem matrícula, e o cartão tem só os links do nome e das atividades e as ações de tema e de encerrar', async () => {
    setup();
    await screen.findByText('Orientando 1');

    const card = cardOf('Orientando 1');

    expect(within(card).getAllByRole('link')).toHaveLength(2);
    expect(
      within(card).getByRole('link', { name: 'Orientando 1' }),
    ).toHaveAttribute('href', '/professor/alunos/101');
    expect(
      within(card).getByRole('link', {
        name: 'Ver atividades de Orientando 1',
      }),
    ).toHaveAttribute('href', '/professor/atividades?aluno=101');
    expect(
      within(card)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Editar tema', 'Encerrar orientação']);
    expect(card.textContent).not.toMatch(/@|Matrícula/);
  });

  it('uma só orientação diz "1 orientando encontrado"', async () => {
    setup([makeAdvisee(1)]);

    expect(await screen.findByText('1 orientando encontrado')).toBeVisible();
  });
});

describe('TeacherAdviseesPage: paginação com a página na URL', () => {
  const FORTY_FIVE = Array.from({ length: 45 }, (_, i) => makeAdvisee(i + 1));

  it('pede 20 por vez, mostra a navegação numerada e não põe nada na URL na página 1', async () => {
    const { fetchMock } = setup(FORTY_FIVE);
    await screen.findByText('Orientando 1');

    const pages = screen.getByRole('navigation', {
      name: 'Paginação dos orientandos',
    });

    expect(screen.getAllByRole('article')).toHaveLength(20);
    expect(
      within(pages).getAllByRole('button', { name: /^Ir para a página \d+$/ }),
    ).toHaveLength(2);
    expect(listParams(fetchMock)).toEqual([{ limit: '20', offset: '0' }]);
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/orientandos$/,
    );
  });

  it('muda de página, guarda a página na URL e pede o deslocamento certo', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { fetchMock, user } = setup(FORTY_FIVE);
    await screen.findByText('Orientando 1');

    await user.click(
      screen.getByRole('button', { name: 'Ir para a página 3' }),
    );

    expect(await screen.findByText('Orientando 41')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/orientandos?pagina=3',
    );
    expect(listParams(fetchMock).at(-1)).toEqual({ limit: '20', offset: '40' });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('abre direto na página da URL, como ao recarregar ou voltar de outra tela', async () => {
    const { fetchMock } = setup(FORTY_FIVE, `${PATH}?pagina=2`);

    expect(await screen.findByText('Orientando 21')).toBeInTheDocument();

    expect(listParams(fetchMock)).toEqual([{ limit: '20', offset: '20' }]);
    expect(
      screen.getByRole('button', { name: 'Página 2, atual' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('voltar o histórico depois de mudar de página restaura a página anterior', async () => {
    const { user } = setup(FORTY_FIVE);
    await screen.findByText('Orientando 1');
    await user.click(
      screen.getByRole('button', { name: 'Ir para a página 2' }),
    );
    await screen.findByText('Orientando 21');

    await user.click(
      screen.getByRole('button', { name: 'Ir para a página 1' }),
    );

    expect(await screen.findByText('Orientando 1')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/orientandos$/,
    );
  });

  it.each(['abc', '0', '-2', '1.5', ''])(
    'trata a página inválida "%s" da URL como a primeira',
    async (value) => {
      const { fetchMock } = setup(FORTY_FIVE, `${PATH}?pagina=${value}`);

      expect(await screen.findByText('Orientando 1')).toBeInTheDocument();

      expect(listParams(fetchMock)).toEqual([{ limit: '20', offset: '0' }]);
    },
  );

  it('uma página além da última volta para a última que existe', async () => {
    const { fetchMock } = setup(FORTY_FIVE, `${PATH}?pagina=9`);

    expect(await screen.findByText('Orientando 41')).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'Página 3, atual' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/professor/orientandos?pagina=3',
      ),
    );
    expect(listParams(fetchMock).at(-1)).toEqual({ limit: '20', offset: '40' });
  });

  it('não mostra a paginação quando tudo cabe em uma página', async () => {
    setup();
    await screen.findByText('Orientando 1');

    expect(
      screen.queryByRole('navigation', { name: 'Paginação dos orientandos' }),
    ).not.toBeInTheDocument();
  });
});

describe('TeacherAdviseesPage: estados, acesso e celular', () => {
  it('mostra um esqueleto enquanto a lista carrega', async () => {
    mockApi({
      ...adviseeRoutes([makeAdvisee(1)]),
      [LIST]: () => new Promise(() => undefined),
    });

    renderApp(PATH);

    expect(await screen.findByTestId('advisees-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('mostra o erro de carregamento e tenta de novo', async () => {
    let attempts = 0;
    mockApi({
      ...adviseeRoutes([makeAdvisee(1)]),
      [LIST]: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: {} }
          : { body: { items: [makeAdvisee(1)], count: 1 } };
      },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(
      await screen.findByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Orientando 1')).toBeVisible();
    expect(attempts).toBe(2);
  });

  it('sem orientandos, explica e leva a "Solicitações"', async () => {
    mockApi(adviseeRoutes([]));
    renderApp(PATH);

    expect(
      await screen.findByText('Você ainda não tem orientandos ativos.'),
    ).toBeVisible();

    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver as solicitações recebidas' }),
    ).toHaveAttribute('href', '/professor/solicitacoes');
  });

  it('um aluno que abre a rota é mandado para a sua área', async () => {
    mockApi({
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
    });
    renderApp(PATH);

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/aluno/dashboard',
      ),
    );
    expect(
      screen.queryByRole('heading', { name: 'Orientandos' }),
    ).not.toBeInTheDocument();
  });

  it('quem não entrou é mandado para o login', async () => {
    mockApi({ 'POST /api/auth/refresh': { status: 401, body: {} } });
    renderApp(PATH);

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/login'),
    );
  });

  it('funciona em tela pequena, com menu recolhido e o cartão inteiro legível', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup();

    expect(
      await screen.findByRole('button', { name: 'Abrir menu' }),
    ).toBeInTheDocument();
    await screen.findByText('Orientando 1');

    const card = cardOf('Orientando 1');
    expect(within(card).getByText('Tema: Tema do orientando 1')).toBeVisible();
    expect(
      within(card).getByRole('list', { name: 'Atividades por status' }),
    ).toBeVisible();
  });
});

describe('TeacherAdviseesPage: atalho para as atividades do orientando', () => {
  it('o botão Ver atividades abre a lista de atividades filtrada por aquele aluno', async () => {
    const { user } = setup([makeAdvisee(1), makeAdvisee(2)]);
    await screen.findByText('Orientando 2');

    await user.click(
      within(cardOf('Orientando 2')).getByRole('link', {
        name: 'Ver atividades de Orientando 2',
      }),
    );

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/atividades?aluno=102',
    );
  });
});
