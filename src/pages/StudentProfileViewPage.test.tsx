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
  it('mostra o nome no título, com o curso e o instituto abaixo, sem e-mail, matrícula nem botões', async () => {
    open();

    const title = await screen.findByRole('heading', {
      level: 1,
      name: 'Ana Souza',
    });

    const content = within(main());
    const course = content.getByText('Ciência da Computação');
    const institute = content.getByText(
      'Instituto de Engenharia e Geociências',
    );
    expect(course).toBeVisible();
    expect(institute).toBeVisible();
    // Curso e instituto vêm logo abaixo do nome, nessa ordem.
    expect(
      title.compareDocumentPosition(course) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      course.compareDocumentPosition(institute) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(main().textContent).not.toMatch(/@|Matrícula/);
    expect(content.queryByRole('button')).not.toBeInTheDocument();
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

    expect(chip(/Banco de Dados/)).toHaveClass('MuiChip-filled');
    expect(chip(/Engenharia de Software/)).toHaveClass('MuiChip-filled');
    expect(chip(/Inteligência Artificial/)).toHaveClass('MuiChip-outlined');
    // As em comum com o professor vêm primeiro, mesmo quando o servidor as mistura.
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Banco de Dados, em comum',
      'Engenharia de Software, em comum',
      'Inteligência Artificial',
    ]);
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

  it.each([0, 1, 3])(
    'com compatibilidade %i, não escreve frase sobre as áreas em comum',
    async (compatibility) => {
      open([
        makeLinkedStudent(7, {
          full_name: 'Ana Souza',
          compatibility,
          areas: [
            { id: 1, name: 'Banco de Dados', is_common: compatibility > 0 },
          ],
        }),
      ]);
      await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

      expect(main().textContent).not.toMatch(/áreas? em comum/i);
      expect(screen.queryByText('Em comum')).not.toBeInTheDocument();
    },
  );

  it('sem áreas, diz isso em texto', async () => {
    open([makeLinkedStudent(7, { full_name: 'Ana Souza', areas: [] })]);

    expect(
      await screen.findByText(
        'Este aluno ainda não cadastrou áreas de interesse.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('list', { name: 'Áreas de interesse' }),
    ).not.toBeInTheDocument();
  });

  it('mostra os artigos em cartões: título e ano e, havendo endereço, o link "Consultar publicação" que avisa da nova aba', async () => {
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
      name: 'Bancos de dados em nuvem (abre em nova aba)',
    });
    expect(link).toHaveAttribute('href', 'https://exemplo.com/a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const articles = within(
      screen.getByRole('region', { name: 'Artigos publicados' }),
    ).getAllByRole('listitem');
    expect(
      within(articles[0]!).getByRole('heading', {
        level: 3,
        name: 'Bancos de dados em nuvem (abre em nova aba)',
      }),
    ).toBeVisible();
    expect(articles[0]).toHaveTextContent('2025');
    expect(articles[1]).toHaveTextContent('Notas de aula');
    expect(articles[1]).toHaveTextContent('2024');
    expect(within(articles[1]!).queryByRole('link')).not.toBeInTheDocument();
  });

  it('sem artigos, diz que o aluno ainda não cadastrou', async () => {
    open();

    expect(
      await screen.findByText('Este aluno ainda não cadastrou artigos.'),
    ).toBeVisible();
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

describe('StudentProfileViewPage: carregamento e foco', () => {
  it('anuncia "Carregando perfil" enquanto carrega e marca a página como ocupada', async () => {
    open(undefined, undefined, {
      [PROFILE_OF_7]: () => new Promise(() => undefined),
    });

    expect(await screen.findByText('Carregando perfil')).toBeInTheDocument();
    expect(
      screen.getByTestId('student-profile-skeleton').parentElement,
    ).toHaveAttribute('aria-busy', 'true');
  });

  it('quando o perfil chega, leva o foco ao título e tira o aviso de carregando', async () => {
    open();

    const title = await screen.findByRole('heading', {
      level: 1,
      name: 'Ana Souza',
    });

    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.queryByText('Carregando perfil')).not.toBeInTheDocument();
  });

  it('repete o "Voltar" no fim da leitura, depois dos artigos, com o mesmo destino', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    const links = screen.getAllByRole('link', {
      name: 'Voltar',
    });

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/professor/solicitacoes');
    expect(links[1]).toHaveAttribute('href', '/professor/solicitacoes');
    const articles = screen.getByRole('region', { name: 'Artigos publicados' });
    expect(
      articles.compareDocumentPosition(links[1]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('mostra um sinal de certo, além da cor, nas áreas em comum', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    const items = within(
      screen.getByRole('list', { name: 'Áreas de interesse' }),
    ).getAllByRole('listitem');

    expect(items[0]!.querySelector('svg')).not.toBeNull();
    expect(items[1]!.querySelector('svg')).toBeNull();
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
      expect(screen.getAllByRole('link', { name: 'Voltar' })[0]!).toBeVisible();
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
    expect(screen.getAllByRole('link', { name: 'Voltar' })[0]!).toHaveAttribute(
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
    expect(
      screen.getByText('Este aluno ainda não cadastrou artigos.'),
    ).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Voltar' })[0]!).toBeVisible();
  });
});

describe('StudentProfileViewPage: o "Voltar"', () => {
  const FROM_ENTRY = (from: unknown) => [
    { pathname: '/professor/alunos/7', state: { from } },
  ];

  it('sem origem, volta para a lista de solicitações', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    expect(screen.getAllByRole('link', { name: 'Voltar' })[0]!).toHaveAttribute(
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

    expect(
      screen.getAllByRole('link', { name: 'Voltar para as solicitações' })[0]!,
    ).toHaveAttribute(
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

    expect(
      screen.getAllByRole('link', { name: 'Voltar para meus orientandos' })[0]!,
    ).toHaveAttribute('href', '/professor/orientandos?pagina=3');
  });

  it.each([
    ['/professor/atividades', 'Voltar para as atividades'],
    ['/professor/historico', 'Voltar para o histórico'],
  ])('a origem %s diz "%s"', async (from, label) => {
    open(undefined, '/professor/alunos/7', {}, { entries: FROM_ENTRY(from) });
    await screen.findByRole('heading', { level: 1, name: 'Ana Souza' });

    expect(screen.getAllByRole('link', { name: label })[0]!).toHaveAttribute(
      'href',
      from,
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

      expect(
        screen.getAllByRole('link', { name: 'Voltar' })[0]!,
      ).toHaveAttribute('href', '/professor/solicitacoes');
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
    await user.click(
      screen.getAllByRole('link', { name: 'Voltar para as solicitações' })[0]!,
    );

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
    renderApp('/professor/orientandos?pagina=3');
    await screen.findByText('Orientando 21');

    const card = screen.getByRole('article', { name: 'Orientando 21' });
    expect(
      within(card).getByRole('link', { name: 'Orientando 21' }),
    ).toHaveAttribute('href', '/professor/alunos/121');
    await user.click(within(card).getByRole('link', { name: 'Orientando 21' }));
    await screen.findByRole('heading', { level: 1, name: 'Orientando 21' });
    await user.click(
      screen.getAllByRole('link', { name: 'Voltar para meus orientandos' })[0]!,
    );

    expect(await screen.findByText('Orientando 21')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/orientandos\?pagina=3$/,
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
