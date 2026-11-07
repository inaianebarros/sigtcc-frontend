import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { ELIGIBLE, advisorRoutes, makeAdvisor } from '../test/advisorsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const SEARCH = 'GET /api/orientadores/busca';

const AREA_A = { id: 1, name: 'Inteligência Artificial' };
const AREA_B = { id: 2, name: 'Banco de Dados' };

const THREE = [
  makeAdvisor(1, {
    full_name: 'Ana Pereira',
    compatibility: 2,
    common_areas: [AREA_A, AREA_B],
  }),
  makeAdvisor(2, {
    full_name: 'Bruno Lima',
    compatibility: 1,
    common_areas: [AREA_B],
  }),
  makeAdvisor(3, { full_name: 'Carla Dias', is_available: false }),
];

describe('AdvisorsPage: a lista', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('abre em /aluno/orientadores com os cards na ordem em que a API devolveu', async () => {
    mockApi(advisorRoutes(THREE));

    renderApp('/aluno/orientadores');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Orientadores' }),
    ).toBeInTheDocument();
    await screen.findByText('Ana Pereira');
    const names = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(['Ana Pereira', 'Bruno Lima', 'Carla Dias']);
  });

  it('mostra em cada card o instituto, a compatibilidade com as áreas em comum e a disponibilidade', async () => {
    mockApi(advisorRoutes(THREE));
    renderApp('/aluno/orientadores');
    await screen.findByText('Ana Pereira');

    const ana = screen.getByRole('article', { name: 'Ana Pereira' });
    expect(
      within(ana).getByText('Instituto de Engenharia e Geociências'),
    ).toBeInTheDocument();
    expect(within(ana).getByText('2 áreas em comum')).toBeInTheDocument();
    expect(
      within(ana).getByText('Inteligência Artificial'),
    ).toBeInTheDocument();
    expect(within(ana).getByText('Banco de Dados')).toBeInTheDocument();
    expect(
      within(ana).getByText('Disponível para orientar'),
    ).toBeInTheDocument();
    const bruno = screen.getByRole('article', { name: 'Bruno Lima' });
    expect(within(bruno).getByText('1 área em comum')).toBeInTheDocument();
    const carla = screen.getByRole('article', { name: 'Carla Dias' });
    expect(
      within(carla).getByText('Nenhuma área em comum'),
    ).toBeInTheDocument();
  });

  it('mostra um esqueleto enquanto a lista carrega', async () => {
    const fetchMock = mockApi({
      ...advisorRoutes(THREE),
      [SEARCH]: () => new Promise(() => undefined),
    });

    renderApp('/aluno/orientadores');

    await screen.findByRole('heading', { level: 1, name: 'Orientadores' });
    expect(await screen.findByTestId('advisors-skeleton')).toBeInTheDocument();
    expect(requestsTo(fetchMock, SEARCH)).toHaveLength(1);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('mostra o erro de carregamento e tenta de novo', async () => {
    let attempts = 0;
    mockApi({
      ...advisorRoutes(THREE),
      [SEARCH]: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: {} }
          : { body: { items: THREE, count: 3 } };
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Ana Pereira')).toBeInTheDocument();
  });

  it('explica o estado vazio quando não há professores no curso do aluno', async () => {
    mockApi(advisorRoutes([]));

    renderApp('/aluno/orientadores');

    expect(
      await screen.findByText(
        'Ainda não há professores cadastrados para o seu curso.',
      ),
    ).toBeVisible();
  });
});

function searchedNames(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, SEARCH).map(([input]) =>
    new URL(String(input), 'http://localhost').searchParams.get('name'),
  );
}

// Esperam o debounce de verdade e renderizam listas de 20 cards: ganham mais tempo que o padrão.
describe('AdvisorsPage: filtro por nome', { timeout: 15000 }, () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('manda o termo ao servidor, aparado, só depois da pausa na digitação', async () => {
    const fetchMock = mockApi(advisorRoutes(THREE));
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await screen.findByText('Ana Pereira');

    await user.type(screen.getByLabelText('Buscar por nome'), '  bru  ');

    await waitFor(() => expect(searchedNames(fetchMock)).toContain('bru'), {
      timeout: 3000,
    });
    expect(searchedNames(fetchMock)).toEqual([null, 'bru']);
    expect(await screen.findByText('Bruno Lima')).toBeInTheDocument();
    expect(screen.queryByText('Ana Pereira')).not.toBeInTheDocument();
  });

  it('não filtra a lista no cliente: mostra o que o servidor devolveu', async () => {
    mockApi({
      ...advisorRoutes(THREE),
      [SEARCH]: (_body, url) =>
        url.searchParams.get('name')
          ? { body: { items: [THREE[2]], count: 1 } }
          : { body: { items: THREE, count: 3 } },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await screen.findByText('Ana Pereira');

    await user.type(screen.getByLabelText('Buscar por nome'), 'xyz');

    await waitFor(
      () => expect(screen.queryByText('Bruno Lima')).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(await screen.findByText('Carla Dias')).toBeInTheDocument();
    expect(screen.queryByText('Ana Pereira')).not.toBeInTheDocument();
  });

  it('encontra o nome sem diferenciar acentos, como o servidor entende', async () => {
    mockApi(
      advisorRoutes([
        makeAdvisor(1, { full_name: 'José Álvaro' }),
        makeAdvisor(2, { full_name: 'Bruno Lima' }),
      ]),
    );
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await screen.findByText('José Álvaro');

    await user.type(screen.getByLabelText('Buscar por nome'), 'jose alvaro');

    await waitFor(
      () => expect(screen.queryByText('Bruno Lima')).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(await screen.findByText('José Álvaro')).toBeInTheDocument();
  });

  it('explica o estado vazio de quando nenhum professor tem o nome digitado e volta ao limpar', async () => {
    mockApi(advisorRoutes(THREE));
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await screen.findByText('Ana Pereira');
    const field = screen.getByLabelText('Buscar por nome');

    await user.type(field, ' zzz ');

    expect(
      await screen.findByText(
        'Nenhum professor encontrado para “zzz”.',
        {},
        { timeout: 3000 },
      ),
    ).toBeVisible();
    await user.clear(field);
    expect(
      await screen.findByText('Ana Pereira', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});

const FORTY_FIVE = Array.from({ length: 45 }, (_, index) =>
  makeAdvisor(index + 1, {
    full_name: `Professor ${String(index + 1).padStart(2, '0')}`,
  }),
);

function pageRequests(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, SEARCH).map(([input]) => {
    const params = new URL(String(input), 'http://localhost').searchParams;
    return {
      name: params.get('name'),
      limit: params.get('limit'),
      offset: params.get('offset'),
    };
  });
}

// Esperam o debounce de verdade e renderizam listas de 20 cards: ganham mais tempo que o padrão.
describe('AdvisorsPage: paginação', { timeout: 15000 }, () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('pede 20 por vez e mostra a navegação numerada, uma página para cada 20', async () => {
    const fetchMock = mockApi(advisorRoutes(FORTY_FIVE));
    renderApp('/aluno/orientadores');

    await screen.findByText('Professor 01');

    expect(screen.getAllByRole('article')).toHaveLength(20);
    expect(pageRequests(fetchMock)).toEqual([
      { name: null, limit: '20', offset: '0' },
    ]);
    const pages = screen.getByRole('navigation', {
      name: 'Paginação dos orientadores',
    });
    expect(
      within(pages).getAllByRole('button', { name: /^Ir para a página \d+$/ }),
    ).toHaveLength(2);
    expect(
      within(pages).getByRole('button', { name: 'Página 1, atual' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('muda de página, pede o deslocamento certo e rola até o topo da lista', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const fetchMock = mockApi(advisorRoutes(FORTY_FIVE));
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await screen.findByText('Professor 01');

    await user.click(
      screen.getByRole('button', { name: 'Ir para a página 3' }),
    );

    expect(await screen.findByText('Professor 41')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(pageRequests(fetchMock).at(-1)).toEqual({
      name: null,
      limit: '20',
      offset: '40',
    });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('mantém o filtro ao trocar de página e volta à página 1 quando o texto muda', async () => {
    const fetchMock = mockApi(advisorRoutes(FORTY_FIVE));
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await screen.findByText('Professor 01');
    const field = screen.getByLabelText('Buscar por nome');

    await user.click(field);
    await user.paste('profess');
    await waitFor(
      () => expect(pageRequests(fetchMock).at(-1)?.name).toBe('profess'),
      { timeout: 3000 },
    );
    await screen.findByText('Professor 01');
    await user.click(
      screen.getByRole('button', { name: 'Ir para a página 2' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Página 2, atual' }),
    ).toBeInTheDocument();
    expect(pageRequests(fetchMock).at(-1)).toEqual({
      name: 'profess',
      limit: '20',
      offset: '20',
    });
    await user.type(field, 'o');

    await waitFor(
      () => expect(pageRequests(fetchMock).at(-1)?.name).toBe('professo'),
      { timeout: 3000 },
    );
    expect(pageRequests(fetchMock).at(-1)?.offset).toBe('0');
    expect(
      await screen.findByRole('button', { name: 'Página 1, atual' }),
    ).toBeInTheDocument();
  });

  it('não mostra a navegação quando tudo cabe em uma página', async () => {
    mockApi(advisorRoutes(THREE));
    renderApp('/aluno/orientadores');
    await screen.findByText('Ana Pereira');

    expect(
      screen.queryByRole('navigation', { name: 'Paginação dos orientadores' }),
    ).not.toBeInTheDocument();
  });
});

const STATUS = 'GET /api/orientacao/minha-solicitacao';

function cardOf(name: string) {
  return screen.getByRole('article', { name });
}

describe('AdvisorsPage: o botão de solicitar e as razões para ele estar desabilitado', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('habilita o botão de quem pode solicitar e desabilita o do professor indisponível, com a razão visível no card', async () => {
    mockApi(advisorRoutes(THREE));
    renderApp('/aluno/orientadores');
    await screen.findByText('Ana Pereira');

    const ana = within(cardOf('Ana Pereira')).getByRole('button', {
      name: 'Solicitar orientação',
    });
    await waitFor(() => expect(ana).toBeEnabled());
    const carla = within(cardOf('Carla Dias')).getByRole('button', {
      name: 'Solicitar orientação',
    });
    expect(carla).toBeDisabled();
    expect(carla).toHaveAccessibleDescription(
      'Este professor não está disponível para novas solicitações.',
    );
    expect(
      within(cardOf('Carla Dias')).getByText(
        'Este professor não está disponível para novas solicitações.',
      ),
    ).toBeVisible();
  });

  it.each([
    [
      'active_advising',
      'Você já tem um orientador ativo, por isso não pode solicitar outra orientação agora.',
    ],
    [
      'pending_request',
      'Você já tem uma solicitação aguardando resposta, por isso não pode enviar outra agora.',
    ],
  ])(
    'com o motivo %s, mostra um aviso no topo com o link para a solicitação e desabilita todos os botões',
    async (reason, message) => {
      mockApi(
        advisorRoutes(THREE, {
          ...ELIGIBLE,
          can_request: false,
          blocked_reason: reason,
        }),
      );
      renderApp('/aluno/orientadores');
      await screen.findByText('Ana Pereira');

      const notice = await screen.findByText(message);
      expect(notice).toBeVisible();
      expect(
        screen.getByRole('link', { name: 'Ver minha solicitação' }),
      ).toHaveAttribute('href', '/aluno/solicitacao');
      for (const name of ['Ana Pereira', 'Bruno Lima']) {
        const button = within(cardOf(name)).getByRole('button', {
          name: 'Solicitar orientação',
        });
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleDescription(
          expect.stringContaining(message),
        );
      }
    },
  );

  it('mantém os botões desabilitados enquanto não sabe se o aluno pode solicitar', async () => {
    mockApi({
      ...advisorRoutes(THREE),
      [STATUS]: () => new Promise(() => undefined),
    });
    renderApp('/aluno/orientadores');
    await screen.findByText('Ana Pereira');

    expect(
      within(cardOf('Ana Pereira')).getByRole('button', {
        name: 'Solicitar orientação',
      }),
    ).toBeDisabled();
    expect(screen.getByTestId('eligibility-skeleton')).toBeInTheDocument();
  });

  it('avisa quando não consegue verificar a elegibilidade e permite tentar de novo', async () => {
    let attempts = 0;
    mockApi({
      ...advisorRoutes(THREE),
      [STATUS]: () => {
        attempts += 1;
        return attempts === 1 ? { status: 500, body: {} } : { body: ELIGIBLE };
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await screen.findByText('Ana Pereira');

    expect(
      await screen.findByText(
        'Não foi possível verificar se você pode solicitar orientação agora.',
      ),
    ).toBeVisible();
    expect(
      within(cardOf('Ana Pereira')).getByRole('button', {
        name: 'Solicitar orientação',
      }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Verificar novamente' }),
    );

    await waitFor(() =>
      expect(
        within(cardOf('Ana Pereira')).getByRole('button', {
          name: 'Solicitar orientação',
        }),
      ).toBeEnabled(),
    );
  });
});

const REQUEST = 'POST /api/orientacao/solicitacoes';

async function openDialogFor(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await screen.findByText(name);
  const button = within(cardOf(name)).getByRole('button', {
    name: 'Solicitar orientação',
  });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  return { button, dialog: await screen.findByRole('dialog') };
}

describe('AdvisorsPage: confirmar e enviar a solicitação', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('abre o diálogo de confirmação e, ao cancelar, fecha sem enviar nada e devolve o foco ao botão', async () => {
    const fetchMock = mockApi({
      ...advisorRoutes(THREE),
      [REQUEST]: { status: 201, body: {} },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');

    const { button, dialog } = await openDialogFor(user, 'Ana Pereira');
    expect(dialog).toHaveAccessibleName(
      'Solicitar orientação ao professor Ana Pereira?',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, REQUEST)).toHaveLength(0);
    expect(button).toHaveFocus();
  });

  it('ao confirmar, envia o pedido, dá o aviso de sucesso e leva para "Minha solicitação"', async () => {
    const fetchMock = mockApi({
      ...advisorRoutes(THREE),
      [REQUEST]: { status: 201, body: { id: 5 } },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    const { dialog } = await openDialogFor(user, 'Bruno Lima');

    await user.click(within(dialog).getByRole('button', { name: 'Solicitar' }));

    expect(
      await screen.findByRole('heading', { name: 'Minha solicitação' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/solicitacao',
    );
    expect(await screen.findByText(/Solicitação enviada/)).toBeVisible();
    expect(
      JSON.parse(String(requestsTo(fetchMock, REQUEST)[0]?.[1]?.body)),
    ).toEqual({ teacher_id: 2 });
  });

  it('fica ocupado enquanto envia e não deixa enviar duas vezes', async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = mockApi({
      ...advisorRoutes(THREE),
      [REQUEST]: async () => {
        await pending;
        return { status: 201, body: {} };
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    const { dialog } = await openDialogFor(user, 'Ana Pereira');

    await user.click(within(dialog).getByRole('button', { name: 'Solicitar' }));

    const sending = await within(dialog).findByRole('button', {
      name: 'Enviando…',
    });
    expect(sending).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
    fireEvent.click(sending);
    expect(requestsTo(fetchMock, REQUEST)).toHaveLength(1);
    release?.();
    await screen.findByRole('heading', { name: 'Minha solicitação' });
  });

  it('no 409, mostra a mensagem da API, fecha o diálogo e recarrega a elegibilidade e a lista', async () => {
    const fetchMock = mockApi({
      ...advisorRoutes(THREE),
      [REQUEST]: {
        status: 409,
        body: { detail: 'Você já tem uma solicitação pendente.' },
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    const { dialog } = await openDialogFor(user, 'Ana Pereira');
    expect(requestsTo(fetchMock, STATUS)).toHaveLength(1);
    expect(requestsTo(fetchMock, SEARCH)).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: 'Solicitar' }));

    expect(
      await screen.findByText('Você já tem uma solicitação pendente.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(requestsTo(fetchMock, STATUS)).toHaveLength(2));
    expect(requestsTo(fetchMock, SEARCH)).toHaveLength(2);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/orientadores',
    );
    expect(await screen.findByText('Ana Pereira')).toBeInTheDocument();
  });

  it('em outras falhas, mostra o erro e mantém a tela', async () => {
    mockApi({
      ...advisorRoutes(THREE),
      [REQUEST]: { status: 500, body: {} },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    const { dialog } = await openDialogFor(user, 'Ana Pereira');

    await user.click(within(dialog).getByRole('button', { name: 'Solicitar' }));

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/orientadores',
    );
    expect(screen.getByText('Ana Pereira')).toBeInTheDocument();
  });
});

describe('AdvisorsPage: celular e leitor de tela', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('funciona em tela pequena: lista, abre o diálogo e envia o pedido', async () => {
    setViewportWidth(PHONE_WIDTH);
    mockApi({
      ...advisorRoutes(THREE),
      [REQUEST]: { status: 201, body: {} },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    expect(
      await screen.findByRole('button', { name: 'Abrir menu' }),
    ).toBeInTheDocument();
    const { dialog } = await openDialogFor(user, 'Ana Pereira');

    await user.click(within(dialog).getByRole('button', { name: 'Solicitar' }));

    expect(
      await screen.findByRole('heading', { name: 'Minha solicitação' }),
    ).toBeInTheDocument();
  });
});

// Esperam o debounce de verdade e renderizam listas de 20 cards: ganham mais tempo que o padrão.
describe(
  'AdvisorsPage: acessibilidade e casos de borda',
  { timeout: 15000 },
  () => {
    beforeEach(() => {
      tokenStore.clear();
      vi.unstubAllGlobals();
      setViewportWidth(DESKTOP_WIDTH);
    });

    it('anuncia as mudanças com uma frase curta numa região própria, sem reler todos os cards', async () => {
      mockApi(advisorRoutes(THREE));
      const { container } = renderApp('/aluno/orientadores');
      await screen.findByText('Ana Pereira');

      const regions = container.querySelectorAll('[aria-live="polite"]');
      const status = [...regions].find((region) =>
        region.textContent?.includes('3 professores encontrados'),
      );

      expect(status).toBeDefined();
      expect(status?.textContent).toBe('3 professores encontrados');
      for (const region of regions) {
        expect(region).not.toContainElement(screen.getByText('Ana Pereira'));
      }
    });

    it('mantém o foco no botão da paginação depois de trocar de página', async () => {
      mockApi(advisorRoutes(FORTY_FIVE));
      const user = userEvent.setup();
      renderApp('/aluno/orientadores');
      await screen.findByText('Professor 01');

      await user.click(
        screen.getByRole('button', { name: 'Ir para a página 2' }),
      );
      await screen.findByText('Professor 21');

      expect(
        screen.getByRole('button', { name: 'Página 2, atual' }),
      ).toHaveFocus();
    });

    it('não ressuscita uma página antiga quando o mesmo termo é digitado de novo', async () => {
      const fetchMock = mockApi(advisorRoutes(FORTY_FIVE));
      const user = userEvent.setup();
      renderApp('/aluno/orientadores');
      await screen.findByText('Professor 01');
      const field = screen.getByLabelText('Buscar por nome');
      await user.click(field);
      await user.paste('profess');
      await waitFor(
        () => expect(pageRequests(fetchMock).at(-1)?.name).toBe('profess'),
        { timeout: 3000 },
      );
      await screen.findByText('Professor 01');
      await user.click(
        screen.getByRole('button', { name: 'Ir para a página 2' }),
      );
      await screen.findByRole('button', { name: 'Página 2, atual' });

      await user.clear(field);
      await user.paste('professo');
      await waitFor(
        () => expect(pageRequests(fetchMock).at(-1)?.name).toBe('professo'),
        { timeout: 3000 },
      );
      await screen.findByText('Professor 01');
      await user.clear(field);
      await user.paste('profess');
      await waitFor(
        () => expect(pageRequests(fetchMock).at(-1)?.name).toBe('profess'),
        { timeout: 3000 },
      );

      expect(pageRequests(fetchMock).at(-1)?.offset).toBe('0');
      expect(
        await screen.findByRole('button', { name: 'Página 1, atual' }),
      ).toBeInTheDocument();
    });

    it('volta para uma página que existe quando a página pedida ficou vazia, sem mostrar o vazio falso', async () => {
      let shrunk = false;
      const fetchMock = mockApi({
        ...advisorRoutes(FORTY_FIVE),
        [SEARCH]: (_body, url) => {
          const offset = Number(url.searchParams.get('offset') ?? 0);
          if (shrunk && offset >= 20) return { body: { items: [], count: 20 } };
          return {
            body: {
              items: FORTY_FIVE.slice(offset, offset + 20),
              count: shrunk ? 20 : 45,
            },
          };
        },
      });
      const user = userEvent.setup();
      renderApp('/aluno/orientadores');
      await screen.findByText('Professor 01');
      shrunk = true;

      await user.click(
        screen.getByRole('button', { name: 'Ir para a página 2' }),
      );

      await waitFor(() =>
        expect(pageRequests(fetchMock).at(-1)?.offset).toBe('0'),
      );
      expect(await screen.findByText('Professor 01')).toBeInTheDocument();
      expect(
        screen.queryByText(
          'Ainda não há professores cadastrados para o seu curso.',
        ),
      ).not.toBeInTheDocument();
    });

    it('refaz só a elegibilidade quando é ela que falha, sem recarregar a lista', async () => {
      let attempts = 0;
      const fetchMock = mockApi({
        ...advisorRoutes(THREE),
        [STATUS]: () => {
          attempts += 1;
          return attempts === 1
            ? { status: 500, body: {} }
            : { body: ELIGIBLE };
        },
      });
      const user = userEvent.setup();
      renderApp('/aluno/orientadores');
      await screen.findByText('Ana Pereira');
      await user.click(
        await screen.findByRole('button', { name: 'Verificar novamente' }),
      );

      await waitFor(() =>
        expect(requestsTo(fetchMock, STATUS)).toHaveLength(2),
      );
      expect(requestsTo(fetchMock, SEARCH)).toHaveLength(1);
    });

    it('não mostra uma mensagem técnica em inglês quando a resposta do envio vem malformada', async () => {
      mockApi({
        ...advisorRoutes(THREE),
        [REQUEST]: { status: 201 },
      });
      const user = userEvent.setup();
      renderApp('/aluno/orientadores');
      const { dialog } = await openDialogFor(user, 'Ana Pereira');

      await user.click(
        within(dialog).getByRole('button', { name: 'Solicitar' }),
      );

      expect(
        await screen.findByText(/Não foi possível conectar ao servidor/),
      ).toBeVisible();
      expect(screen.queryByText(/JSON/)).not.toBeInTheDocument();
    });

    it('usa uma mensagem neutra, sem inventar o motivo, quando o servidor bloqueia sem dizer por quê', async () => {
      mockApi(
        advisorRoutes(THREE, {
          ...ELIGIBLE,
          can_request: false,
          blocked_reason: null,
        }),
      );
      renderApp('/aluno/orientadores');
      await screen.findByText('Ana Pereira');

      expect(
        await screen.findByText(
          /No momento você não pode solicitar uma orientação/,
        ),
      ).toBeVisible();
      expect(screen.queryByText(/aguardando resposta/)).not.toBeInTheDocument();
    });
  },
);
