import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { adviseeRoutes, makeAdvisee } from '../test/adviseesApi';
import {
  linkedStudentRoutes,
  makeLinkedStudent,
} from '../test/linkedStudentApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { makeRequest, requestRoutes } from '../test/teacherRequestsApi';
import { teacherProfileRoutes } from '../test/teacherProfileApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const PROFILE_OF_7 = 'GET /api/alunos/7/perfil';

function open(
  students = [makeLinkedStudent(7, { full_name: 'Ana Souza' })],
  path = '/professor/alunos/7',
  extra: Parameters<typeof mockApi>[0] = {},
  options?: Parameters<typeof renderApp>[1],
) {
  const fetchMock = mockApi({
    ...teacherProfileRoutes(),
    ...linkedStudentRoutes(students),
    ...extra,
  });
  const user = userEvent.setup();
  renderApp(path, options);
  return { fetchMock, user };
}

const main = () => screen.getByRole('main');

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('StudentProfileViewPage: o conteúdo', () => {
  it('mostra o nome no título, o instituto e o curso, sem e-mail, matrícula nem botões', async () => {
    open();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ana Souza' }),
    ).toBeInTheDocument();

    const facts = within(main());
    expect(facts.getByText('Instituto')).toBeVisible();
    expect(
      facts.getByText('Instituto de Engenharia e Geociências'),
    ).toBeVisible();
    expect(facts.getByText('Curso')).toBeVisible();
    expect(facts.getByText('Ciência da Computação')).toBeVisible();
    expect(main().textContent).not.toMatch(/@|Matrícula/);
    expect(facts.queryByRole('button')).not.toBeInTheDocument();
  });

  it('mostra as áreas, com as em comum como chips preenchidos e as outras só com contorno', async () => {
    open([
      makeLinkedStudent(7, {
        full_name: 'Ana Souza',
        compatibility: 2,
        areas: [
          { id: 1, name: 'Banco de Dados', is_common: true },
          { id: 2, name: 'Inteligência Artificial', is_common: false },
          { id: 3, name: 'Engenharia de Software', is_common: true },
        ],
      }),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    const list = screen.getByRole('list', { name: 'Áreas de interesse' });
    const chip = (name: RegExp) =>
      within(list).getByText(name).closest('.MuiChip-root')!;

    expect(screen.getByText('2 áreas em comum')).toBeVisible();
    expect(chip(/Banco de Dados/)).toHaveClass('MuiChip-filled');
    expect(chip(/Engenharia de Software/)).toHaveClass('MuiChip-filled');
    expect(chip(/Inteligência Artificial/)).toHaveClass('MuiChip-outlined');
  });

  it('a diferença das áreas em comum não depende só da cor: o leitor de tela ouve "em comum"', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    const items = within(
      screen.getByRole('list', { name: 'Áreas de interesse' }),
    ).getAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual([
      'Banco de Dados, em comum',
      'Inteligência Artificial',
    ]);
  });

  it.each([
    [0, 'Nenhuma área em comum'],
    [1, '1 área em comum'],
    [3, '3 áreas em comum'],
  ])('com compatibilidade %i, diz "%s"', async (compatibility, text) => {
    open([
      makeLinkedStudent(7, {
        full_name: 'Ana Souza',
        compatibility,
        areas: [
          { id: 1, name: 'Banco de Dados', is_common: compatibility > 0 },
        ],
      }),
    ]);

    expect(await screen.findByText(text)).toBeVisible();
  });

  it('mostra os artigos: o título com ano e, havendo endereço, como link externo que avisa da nova aba', async () => {
    open([
      makeLinkedStudent(7, {
        full_name: 'Ana Souza',
        articles: [
          {
            title: 'Bancos de dados em nuvem',
            year: 2025,
            url: 'https://exemplo.com/a',
          },
          { title: 'Notas de aula', year: 2024, url: '' },
        ],
      }),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    const link = screen.getByRole('link', {
      name: 'Bancos de dados em nuvem (abre em uma nova aba)',
    });
    expect(link).toHaveAttribute('href', 'https://exemplo.com/a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const articles = within(
      screen.getByRole('list', { name: 'Artigos publicados' }),
    ).getAllByRole('listitem');
    expect(articles[0]).toHaveTextContent('2025');
    expect(articles[1]).toHaveTextContent('Notas de aula');
    expect(articles[1]).toHaveTextContent('2024');
    expect(within(articles[1]!).queryByRole('link')).not.toBeInTheDocument();
  });

  it('sem artigos, diz "Nenhum artigo cadastrado"', async () => {
    open();

    expect(await screen.findByText('Nenhum artigo cadastrado')).toBeVisible();
  });

  it('não faz link de um endereço que não seja http ou https', async () => {
    open([
      makeLinkedStudent(7, {
        full_name: 'Ana Souza',
        articles: [
          { title: 'Estranho', year: 2025, url: 'javascript:alert(1)' },
        ],
      }),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    expect(screen.getByText(/Estranho/)).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /Estranho/ }),
    ).not.toBeInTheDocument();
  });

  it('mostra um esqueleto enquanto o perfil carrega', async () => {
    open(undefined, undefined, {
      [PROFILE_OF_7]: () => new Promise(() => undefined),
    });

    expect(
      await screen.findByTestId('student-profile-skeleton'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Perfil do aluno' }),
    ).toBeInTheDocument();
  });
});

describe('StudentProfileViewPage: aluno não encontrado e erros', () => {
  it.each(['abc', '0', '1.5', '-3'])(
    'o id "%s" não é um inteiro: mostra "Aluno não encontrado" sem chamar a API',
    async (id) => {
      const { fetchMock } = open(undefined, `/professor/alunos/${id}`);

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'Aluno não encontrado',
        }),
      ).toBeInTheDocument();

      expect(
        requestsTo(fetchMock, PROFILE_OF_7).length +
          fetchMock.mock.calls.filter(([input]) =>
            String(input).includes('/alunos/'),
          ).length,
      ).toBe(0);
      expect(screen.getByRole('link', { name: 'Voltar' })).toBeVisible();
    },
  );

  it('no 404, mostra o mesmo "Aluno não encontrado", sem dizer o motivo, e o link de volta', async () => {
    open(undefined, '/professor/alunos/999');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Aluno não encontrado',
      }),
    ).toBeInTheDocument();
    expect(main().textContent).not.toMatch(/vinculad|permiss|inativ/i);
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/professor/solicitacoes',
    );
  });

  it('em outros erros, mostra o alerta e tenta de novo', async () => {
    let attempts = 0;
    const { fetchMock, user } = open(undefined, undefined, {
      [PROFILE_OF_7]: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: {} }
          : { body: makeLinkedStudent(7, { full_name: 'Ana Souza' }) };
      },
    });

    const retry = await screen.findByRole('button', {
      name: 'Tentar novamente',
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Perfil do aluno' }),
    ).toBeInTheDocument();
    await user.click(retry);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ana Souza' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Perfil do aluno' }),
    ).not.toBeInTheDocument();
    expect(attempts).toBe(2);
    expect(requestsTo(fetchMock, PROFILE_OF_7)).toHaveLength(2);
  });
});

describe('StudentProfileViewPage: acesso e celular', () => {
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
    renderApp('/professor/alunos/7');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/aluno/dashboard',
      ),
    );
  });

  it('quem não entrou é mandado para o login', async () => {
    mockApi({ 'POST /api/auth/refresh': { status: 401, body: {} } });
    renderApp('/professor/alunos/7');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/login'),
    );
  });

  it('funciona em tela pequena, com menu recolhido e o conteúdo inteiro legível', async () => {
    setViewportWidth(PHONE_WIDTH);
    open();

    expect(
      await screen.findByRole('button', { name: 'Abrir menu' }),
    ).toBeInTheDocument();
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });
    expect(
      screen.getByRole('list', { name: 'Áreas de interesse' }),
    ).toBeVisible();
    expect(screen.getByText('Nenhum artigo cadastrado')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeVisible();
  });
});

describe('StudentProfileViewPage: o "Voltar"', () => {
  const FROM_ENTRY = (from: unknown) => [
    { pathname: '/professor/alunos/7', state: { from } },
  ];

  it('sem origem, volta para a lista de solicitações', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/professor/solicitacoes',
    );
  });

  it('com a origem no estado da navegação, volta para ela, com a página e o filtro', async () => {
    open(
      undefined,
      '/professor/alunos/7',
      {},
      {
        entries: FROM_ENTRY(
          '/professor/solicitacoes?situacao=accepted&pagina=2',
        ),
      },
    );
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/professor/solicitacoes?situacao=accepted&pagina=2',
    );
  });

  it('a origem pode ser a lista de orientandos', async () => {
    open(
      undefined,
      '/professor/alunos/7',
      {},
      {
        entries: FROM_ENTRY('/professor/orientandos?pagina=3'),
      },
    );
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/professor/orientandos?pagina=3',
    );
  });

  it.each([
    ['https://exemplo.com/roubo'],
    ['//exemplo.com'],
    ['/aluno/perfil'],
    ['/professor/perfil'],
    ['/aluno/orientadores'],
    [42],
  ])(
    'uma origem que não seja uma das duas listas (%j) é ignorada',
    async (from) => {
      open(undefined, '/professor/alunos/7', {}, { entries: FROM_ENTRY(from) });
      await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

      expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
        'href',
        '/professor/solicitacoes',
      );
    },
  );
});

describe('Links para o perfil nas listas', () => {
  const REQUESTS = [
    ...Array.from({ length: 45 }, (_, index) =>
      makeRequest(index + 1, 'pending'),
    ),
    ...Array.from({ length: 25 }, (_, index) =>
      makeRequest(100 + index, 'accepted'),
    ),
  ];

  function openList(path: string) {
    const fetchMock = mockApi({
      ...requestRoutes(REQUESTS),
      ...linkedStudentRoutes([
        makeLinkedStudent(101, { full_name: 'Aluno 1' }),
        makeLinkedStudent(220, { full_name: 'Aluno 120' }),
      ]),
    });
    const user = userEvent.setup();
    renderApp(path);
    return { fetchMock, user };
  }

  it('na lista de solicitações, o nome do aluno é um link para o perfil dele', async () => {
    openList('/professor/solicitacoes');
    await screen.findByText('Aluno 1');

    const link = within(
      screen.getByRole('article', { name: 'Aluno 1' }),
    ).getByRole('link', { name: 'Aluno 1' });

    expect(link).toHaveAttribute('href', '/professor/alunos/101');
  });

  it('abre o perfil e o "Voltar" devolve à lista no mesmo filtro e na mesma página', async () => {
    const { user } = openList(
      '/professor/solicitacoes?situacao=accepted&pagina=2',
    );
    await screen.findByText('Aluno 120');

    await user.click(screen.getByRole('link', { name: 'Aluno 120' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aluno 120' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/alunos/220',
    );
    await user.click(screen.getByRole('link', { name: 'Voltar' }));

    expect(await screen.findByText('Aluno 120')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/solicitacoes\?situacao=accepted&pagina=2$/,
    );
    expect(screen.getByRole('radio', { name: 'Aceitas' })).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Página 2, atual' }),
    ).toBeInTheDocument();
  });

  it('na lista de orientandos, o nome do aluno é um link para o perfil, e o "Voltar" volta à mesma página', async () => {
    const ADVISEES = Array.from({ length: 45 }, (_, index) =>
      makeAdvisee(index + 1),
    );
    mockApi({
      ...adviseeRoutes(ADVISEES),
      ...linkedStudentRoutes([
        makeLinkedStudent(121, { full_name: 'Orientando 21' }),
      ]),
    });
    const user = userEvent.setup();
    renderApp('/professor/orientandos?pagina=2');
    await screen.findByText('Orientando 21');

    const card = screen.getByRole('article', { name: 'Orientando 21' });
    expect(
      within(card).getByRole('link', { name: 'Orientando 21' }),
    ).toHaveAttribute('href', '/professor/alunos/121');
    await user.click(within(card).getByRole('link', { name: 'Orientando 21' }));
    await screen.findByRole('heading', { level: 1, name: 'Orientando 21' });
    await user.click(screen.getByRole('link', { name: 'Voltar' }));

    expect(await screen.findByText('Orientando 21')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/orientandos\?pagina=2$/,
    );
  });

  it('o item do menu da lista de origem continua selecionado no perfil: Solicitações', async () => {
    const { user } = openList('/professor/solicitacoes');
    await screen.findByText('Aluno 1');
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu).getByRole('link', { name: 'Solicitações' }),
    ).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('link', { name: 'Aluno 1' }));
    await screen.findByRole('heading', { level: 1, name: 'Aluno 1' });

    expect(
      within(menu).getByRole('link', { name: 'Solicitações' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(menu).getByRole('link', { name: 'Meu perfil' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('o item do menu da lista de origem continua selecionado no perfil: Orientandos', async () => {
    mockApi({
      ...adviseeRoutes([makeAdvisee(1)]),
      ...linkedStudentRoutes([
        makeLinkedStudent(101, { full_name: 'Orientando 1' }),
      ]),
    });
    const user = userEvent.setup();
    renderApp('/professor/orientandos');
    await user.click(await screen.findByRole('link', { name: 'Orientando 1' }));
    await screen.findByRole('heading', { level: 1, name: 'Orientando 1' });

    const menu = screen.getByRole('navigation', { name: 'Menu principal' });

    expect(
      within(menu).getByRole('link', { name: 'Orientandos' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(menu).getByRole('link', { name: 'Solicitações' }),
    ).not.toHaveAttribute('aria-current');
  });
});
