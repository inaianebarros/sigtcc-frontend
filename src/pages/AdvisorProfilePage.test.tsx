import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { ELIGIBLE, advisorRoutes, makeAdvisor } from '../test/advisorsApi';
import {
  advisorProfileRoutes,
  makeAdvisorProfile,
} from '../test/advisorProfileApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { teacherProfileRoutes } from '../test/teacherProfileApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const PROFILE_OF_7 = 'GET /api/professores/7/perfil';
const STATUS = 'GET /api/orientacao/minha-solicitacao';
const REQUEST = 'POST /api/orientacao/solicitacoes';

type Routes = Parameters<typeof mockApi>[0];

function open(
  profiles = [makeAdvisorProfile(7, { full_name: 'Marta Rocha' })],
  path = '/aluno/orientadores/7',
  extra: Routes = {},
  options?: Parameters<typeof renderApp>[1],
  status: Record<string, unknown> = ELIGIBLE,
) {
  const fetchMock = mockApi({
    ...advisorRoutes([], status),
    ...advisorProfileRoutes(profiles),
    [REQUEST]: { status: 201, body: {} },
    ...extra,
  });
  const user = userEvent.setup();
  const { router } = renderApp(path, options);
  return { fetchMock, user, router };
}

const main = () => screen.getByRole('main');

async function loaded() {
  return screen.findByRole('heading', { level: 1, name: 'Marta Rocha' });
}

function requestButton() {
  return within(main()).getByRole('button', { name: 'Solicitar orientação' });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('AdvisorProfilePage: o conteúdo', () => {
  it('mostra o nome no título, o instituto, os cursos e a disponibilidade, sem e-mail nem matrícula', async () => {
    open([
      makeAdvisorProfile(7, {
        full_name: 'Marta Rocha',
        courses: [
          { id: 10, name: 'Ciência da Computação' },
          { id: 12, name: 'Sistemas de Informação' },
        ],
      }),
    ]);
    await loaded();

    const page = within(main());
    expect(page.getByText('Instituto')).toBeVisible();
    expect(
      page.getByText('Instituto de Engenharia e Geociências'),
    ).toBeVisible();
    expect(page.getByText('Cursos')).toBeVisible();
    expect(
      page.getByText('Ciência da Computação, Sistemas de Informação'),
    ).toBeVisible();
    expect(page.getByText('Disponível para orientar')).toBeVisible();
    expect(main().textContent).not.toMatch(/@|Matrícula/);
  });

  it('mostra as áreas, com as em comum como chips preenchidos e as outras só com contorno', async () => {
    open([
      makeAdvisorProfile(7, {
        full_name: 'Marta Rocha',
        compatibility: 2,
        areas: [
          { id: 1, name: 'Banco de Dados', is_common: true },
          { id: 2, name: 'Redes de Computadores', is_common: false },
          { id: 3, name: 'Engenharia de Software', is_common: true },
        ],
      }),
    ]);
    await loaded();

    const list = screen.getByRole('list', { name: 'Áreas de interesse' });
    const chip = (name: RegExp) =>
      within(list).getByText(name).closest('.MuiChip-root')!;

    expect(screen.getByText('2 áreas em comum')).toBeVisible();
    expect(chip(/Banco de Dados/)).toHaveClass('MuiChip-filled');
    expect(chip(/Engenharia de Software/)).toHaveClass('MuiChip-filled');
    expect(chip(/Redes de Computadores/)).toHaveClass('MuiChip-outlined');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Banco de Dados, em comum',
      'Redes de Computadores',
      'Engenharia de Software, em comum',
    ]);
  });

  it.each([
    [0, 'Nenhuma área em comum'],
    [1, '1 área em comum'],
  ])('com compatibilidade %i, diz "%s"', async (compatibility, text) => {
    open([
      makeAdvisorProfile(7, {
        full_name: 'Marta Rocha',
        compatibility,
        areas: [
          { id: 1, name: 'Banco de Dados', is_common: compatibility > 0 },
        ],
      }),
    ]);

    expect(await screen.findByText(text)).toBeVisible();
  });

  it('mostra os artigos, com o link externo em nova aba e o aviso acessível quando há endereço', async () => {
    open([
      makeAdvisorProfile(7, {
        full_name: 'Marta Rocha',
        articles: [
          {
            title: 'Redes definidas por software',
            year: 2025,
            url: 'https://exemplo.com/r',
          },
          { title: 'Notas de aula', year: 2023, url: '' },
        ],
      }),
    ]);
    await loaded();

    const link = screen.getByRole('link', {
      name: 'Redes definidas por software (abre em uma nova aba)',
    });
    expect(link).toHaveAttribute('href', 'https://exemplo.com/r');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const articles = within(
      screen.getByRole('list', { name: 'Artigos publicados' }),
    ).getAllByRole('listitem');
    expect(articles[0]).toHaveTextContent('2025');
    expect(within(articles[1]!).queryByRole('link')).not.toBeInTheDocument();
  });

  it('sem artigos, diz "Nenhum artigo cadastrado"', async () => {
    open();

    expect(await screen.findByText('Nenhum artigo cadastrado')).toBeVisible();
  });

  it('mostra um esqueleto e o título geral enquanto o perfil carrega', async () => {
    open(undefined, undefined, {
      [PROFILE_OF_7]: () => new Promise(() => undefined),
    });

    expect(
      await screen.findByTestId('advisor-profile-skeleton'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Perfil do professor' }),
    ).toBeInTheDocument();
  });
});

describe('AdvisorProfilePage: solicitar orientação', () => {
  it('o botão fica habilitado, e o diálogo confirma, nomeia o professor e, ao cancelar, devolve o foco', async () => {
    const { fetchMock, user } = open();
    await loaded();
    await waitFor(() => expect(requestButton()).toBeEnabled());

    await user.click(requestButton());

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName(
      'Solicitar orientação ao professor Marta Rocha?',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, REQUEST)).toHaveLength(0);
    expect(requestButton()).toHaveFocus();
  });

  it('ao confirmar, envia o pedido uma vez, avisa e leva a "Minha solicitação"', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, user } = open(undefined, undefined, {
      [REQUEST]: async () => {
        await gate;
        return { status: 201, body: {} };
      },
    });
    await loaded();
    await waitFor(() => expect(requestButton()).toBeEnabled());
    await user.click(requestButton());
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Solicitar' }));

    const sending = await within(dialog).findByRole('button', {
      name: 'Enviando…',
    });
    expect(sending).toBeDisabled();
    fireEvent.click(sending);
    expect(requestsTo(fetchMock, REQUEST)).toHaveLength(1);
    release?.();
    expect(
      await screen.findByRole('heading', { name: 'Minha solicitação' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/solicitacao',
    );
    expect(await screen.findByText(/Solicitação enviada/)).toBeVisible();
    expect(
      JSON.parse(String(requestsTo(fetchMock, REQUEST)[0]?.[1]?.body)),
    ).toEqual({ teacher_id: 7 });
  });

  it.each([
    ['pending_request', /já tem uma solicitação aguardando resposta/],
    ['active_advising', /já tem um orientador ativo/],
  ])(
    'com o motivo "%s", o perfil continua visível e o botão fica desabilitado com o motivo à vista',
    async (reason, message) => {
      open(undefined, undefined, {}, undefined, {
        ...ELIGIBLE,
        can_request: false,
        blocked_reason: reason,
      });
      await loaded();

      const notice = await screen.findByText(message);

      expect(notice).toBeVisible();
      expect(requestButton()).toBeDisabled();
      expect(requestButton()).toHaveAttribute(
        'aria-describedby',
        expect.stringContaining(notice.closest('[id]')!.id),
      );
      expect(
        within(main()).getByRole('link', { name: 'Ver minha solicitação' }),
      ).toHaveAttribute('href', '/aluno/solicitacao');
      expect(
        screen.getByRole('list', { name: 'Áreas de interesse' }),
      ).toBeVisible();
    },
  );

  it('com o professor indisponível, o botão fica desabilitado e o motivo está no texto', async () => {
    open([
      makeAdvisorProfile(7, { full_name: 'Marta Rocha', is_available: false }),
    ]);
    await loaded();

    const reason = within(main()).getByText(
      'Este professor não está disponível para novas solicitações.',
    );

    expect(reason).toBeVisible();
    await waitFor(() => expect(requestButton()).toBeDisabled());
    expect(requestButton()).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(reason.id),
    );
  });

  it('se a elegibilidade não carrega, avisa, mantém o botão desabilitado e permite verificar de novo', async () => {
    let attempts = 0;
    const { user } = open(undefined, undefined, {
      [STATUS]: () => {
        attempts += 1;
        return attempts === 1 ? { status: 500, body: {} } : { body: ELIGIBLE };
      },
    });
    await loaded();

    await user.click(
      await screen.findByRole('button', { name: 'Verificar novamente' }),
    );

    await waitFor(() => expect(requestButton()).toBeEnabled());
    expect(attempts).toBe(2);
  });

  it('no 409, mostra a mensagem da API, fecha o diálogo e relê a elegibilidade e o perfil', async () => {
    const { fetchMock, user } = open(undefined, undefined, {
      [REQUEST]: {
        status: 409,
        body: { detail: 'Você já tem uma solicitação pendente.' },
      },
    });
    await loaded();
    await waitFor(() => expect(requestButton()).toBeEnabled());
    await user.click(requestButton());
    const dialog = await screen.findByRole('dialog');
    const before = {
      status: requestsTo(fetchMock, STATUS).length,
      profile: requestsTo(fetchMock, PROFILE_OF_7).length,
    };

    await user.click(within(dialog).getByRole('button', { name: 'Solicitar' }));

    expect(
      await screen.findByText('Você já tem uma solicitação pendente.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => {
      expect(requestsTo(fetchMock, STATUS).length).toBeGreaterThan(
        before.status,
      );
      expect(requestsTo(fetchMock, PROFILE_OF_7).length).toBeGreaterThan(
        before.profile,
      );
    });
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/orientadores/7',
    );
  });

  it('em outra falha, mostra o erro e fica na tela do perfil', async () => {
    const { user } = open(undefined, undefined, {
      [REQUEST]: { status: 500, body: {} },
    });
    await loaded();
    await waitFor(() => expect(requestButton()).toBeEnabled());
    await user.click(requestButton());
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Solicitar' }));

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/orientadores/7',
    );
  });
});

describe('AdvisorProfilePage: professor não encontrado e erros', () => {
  it.each(['abc', '0', '1.5', '-3'])(
    'o id "%s" não é um inteiro: mostra "Professor não encontrado" sem chamar a API',
    async (id) => {
      const { fetchMock } = open(undefined, `/aluno/orientadores/${id}`);

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'Professor não encontrado',
        }),
      ).toBeInTheDocument();

      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).includes('/professores/'),
        ),
      ).toHaveLength(0);
      expect(screen.getByRole('link', { name: 'Voltar' })).toBeVisible();
    },
  );

  it('no 404, mostra o mesmo "Professor não encontrado", sem dizer o motivo, e o link de volta', async () => {
    open(undefined, '/aluno/orientadores/999');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Professor não encontrado',
      }),
    ).toBeInTheDocument();
    expect(main().textContent).not.toMatch(/curso|inativ|permiss/i);
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/aluno/orientadores',
    );
    expect(
      within(main()).queryByRole('button', { name: 'Solicitar orientação' }),
    ).not.toBeInTheDocument();
  });

  it('em outros erros, mostra o alerta com o título geral e tenta de novo', async () => {
    let attempts = 0;
    const { fetchMock, user } = open(undefined, undefined, {
      [PROFILE_OF_7]: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: {} }
          : { body: makeAdvisorProfile(7, { full_name: 'Marta Rocha' }) };
      },
    });

    const retry = await screen.findByRole('button', {
      name: 'Tentar novamente',
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Perfil do professor' }),
    ).toBeInTheDocument();
    await user.click(retry);

    expect(await loaded()).toBeInTheDocument();
    expect(attempts).toBe(2);
    expect(requestsTo(fetchMock, PROFILE_OF_7)).toHaveLength(2);
  });
});

describe('AdvisorProfilePage: acesso e celular', () => {
  it('um professor que abre a rota é mandado para a sua área', async () => {
    mockApi(teacherProfileRoutes());
    renderApp('/aluno/orientadores/7');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/professor/dashboard',
      ),
    );
  });

  it('quem não entrou é mandado para o login', async () => {
    mockApi({ 'POST /api/auth/refresh': { status: 401, body: {} } });
    renderApp('/aluno/orientadores/7');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/login'),
    );
  });

  it('funciona em tela pequena: menu recolhido, conteúdo legível, botão e diálogo', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { user } = open();
    expect(
      await screen.findByRole('button', { name: 'Abrir menu' }),
    ).toBeInTheDocument();
    await loaded();
    expect(
      screen.getByRole('list', { name: 'Áreas de interesse' }),
    ).toBeVisible();
    await waitFor(() => expect(requestButton()).toBeEnabled());

    await user.click(requestButton());

    expect(await screen.findByRole('dialog')).toBeVisible();
  });
});

describe('AdvisorProfilePage: o "Voltar"', () => {
  const FROM_ENTRY = (from: unknown) => [
    { pathname: '/aluno/orientadores/7', state: { from } },
  ];

  it('sem origem, volta para a lista de orientadores', async () => {
    open();
    await loaded();

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/aluno/orientadores',
    );
  });

  it('com a origem no estado da navegação, volta para ela, com o nome, a página e a chave', async () => {
    open(
      undefined,
      '/aluno/orientadores/7',
      {},
      {
        entries: FROM_ENTRY(
          '/aluno/orientadores?nome=Marta&show_all=true&pagina=2',
        ),
      },
    );
    await loaded();

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/aluno/orientadores?nome=Marta&show_all=true&pagina=2',
    );
  });

  it.each([
    ['https://exemplo.com/roubo'],
    ['//exemplo.com'],
    ['/professor/solicitacoes'],
    ['/aluno/perfil'],
    [42],
  ])(
    'uma origem que não seja a lista de orientadores (%j) é ignorada',
    async (from) => {
      open(
        undefined,
        '/aluno/orientadores/7',
        {},
        { entries: FROM_ENTRY(from) },
      );
      await loaded();

      expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
        'href',
        '/aluno/orientadores',
      );
    },
  );
});

describe('Link para o perfil na lista de orientadores', () => {
  const ADVISORS = [
    makeAdvisor(7, { full_name: 'Marta Rocha', compatibility: 1 }),
    makeAdvisor(8, { full_name: 'Paulo Nunes' }),
  ];

  function openList(path: string) {
    const fetchMock = mockApi({
      ...advisorRoutes(ADVISORS),
      ...advisorProfileRoutes([
        makeAdvisorProfile(7, { full_name: 'Marta Rocha' }),
        makeAdvisorProfile(8, { full_name: 'Paulo Nunes' }),
      ]),
    });
    const user = userEvent.setup();
    renderApp(path);
    return { fetchMock, user };
  }

  it('o nome do professor no cartão é um link para o perfil dele', async () => {
    openList('/aluno/orientadores');
    await screen.findByText('Marta Rocha');

    const card = screen.getByRole('article', { name: 'Marta Rocha' });

    expect(
      within(card).getByRole('link', { name: 'Marta Rocha' }),
    ).toHaveAttribute('href', '/aluno/orientadores/7');
    expect(within(card).getAllByRole('link')).toHaveLength(1);
  });

  it('abre o perfil e o "Voltar" devolve à lista com o mesmo nome e a mesma chave', async () => {
    const { user } = openList('/aluno/orientadores?nome=Marta');
    await screen.findByText('Marta Rocha');

    await user.click(screen.getByRole('link', { name: 'Marta Rocha' }));

    expect(await loaded()).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/orientadores/7',
    );
    await user.click(screen.getByRole('link', { name: 'Voltar' }));

    expect(await screen.findByText('Marta Rocha')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/orientadores\?nome=Marta$/,
    );
    expect(screen.getByLabelText('Buscar por nome')).toHaveValue('Marta');
    expect(screen.queryByText('Paulo Nunes')).not.toBeInTheDocument();
  });

  it('o item "Orientadores" do menu continua selecionado no perfil', async () => {
    const { user } = openList('/aluno/orientadores');
    await user.click(await screen.findByRole('link', { name: 'Marta Rocha' }));
    await loaded();

    const menu = screen.getByRole('navigation', { name: 'Menu principal' });

    expect(
      within(menu).getByRole('link', { name: 'Orientadores' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(menu).getByRole('link', { name: 'Meu perfil' }),
    ).not.toHaveAttribute('aria-current');
  });
});
