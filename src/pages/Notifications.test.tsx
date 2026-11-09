import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import {
  makeNotification,
  notificationsServer,
  numberedNotifications,
} from '../test/notificationsApi';
import type { FakeNotification } from '../test/notificationsApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const COUNT = 'GET /api/notificacoes/nao-lidas/contagem';
const LIST = 'GET /api/notificacoes';
const READ_ALL = 'PATCH /api/notificacoes/todas-lidas';
const READ_ONE = 'PATCH /api/notificacoes/:id/lida';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup(
  initial: FakeNotification[] = numberedNotifications(3),
  {
    user = 'student',
    path,
    overrides = {},
  }: {
    user?: 'student' | 'teacher' | 'admin';
    path?: string;
    overrides?: Overrides;
  } = {},
) {
  const server = notificationsServer(initial, user, overrides as never);
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup({ applyAccept: false });
  renderApp(
    path ??
      (user === 'student'
        ? '/aluno/dashboard'
        : user === 'teacher'
          ? '/professor/dashboard'
          : '/admin'),
  );
  return { fetchMock, events, server };
}

// O sino também é buscado com o painel aberto, quando o resto da página fica oculto ao leitor de tela.
const bell = (name: RegExp | string = /^Notificações, \d+ não lidas?$/) =>
  screen.findByRole('button', { name, hidden: true });

async function openPanel(events: ReturnType<typeof userEvent.setup>) {
  await events.click(await bell());
  return screen.findByRole('dialog', { name: 'Notificações' });
}

/** A primeira notificação do painel: os detalhes dela também são itens de lista, vindos depois. */
async function firstItem(panel: HTMLElement): Promise<HTMLElement> {
  const [first] = await within(panel).findAllByRole('listitem');
  return first!;
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

const location = () => screen.getByTestId('location');

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  setVisibility('visible');
});

describe('Sino: quem o vê e o selo', () => {
  it.each(['student', 'teacher'] as const)(
    'o %s vê o sino com o selo e o rótulo de acessibilidade',
    async (user) => {
      setup(numberedNotifications(3), { user });

      const button = await bell('Notificações, 3 não lidas');

      expect(within(button).getByText('3')).toBeVisible();
    },
  );

  it('o administrador não vê o sino e nada é consultado para ele', async () => {
    const { fetchMock } = setup(numberedNotifications(3), { user: 'admin' });

    await screen.findByRole('heading', { name: 'Área do Administrador' });

    expect(
      screen.queryByRole('button', { name: /Notificações/ }),
    ).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, COUNT)).toHaveLength(0);
  });

  it('quem não entrou não vê o sino', async () => {
    mockApi({ 'POST /api/auth/refresh': { status: 401, body: {} } });
    renderApp('/login');

    await screen.findByRole('heading', { name: 'Entrar' });

    expect(
      screen.queryByRole('button', { name: /Notificações/ }),
    ).not.toBeInTheDocument();
  });

  it('acima de 99 o selo mostra "99+" e o rótulo traz o número', async () => {
    setup(numberedNotifications(150));

    const button = await bell('Notificações, 150 não lidas');

    expect(within(button).getByText('99+')).toBeVisible();
  });

  it('com 99 o selo mostra 99, sem o "+"', async () => {
    setup(numberedNotifications(99));

    const button = await bell('Notificações, 99 não lidas');

    expect(within(button).getByText('99')).toBeVisible();
  });

  it('sem não lidas o rótulo diz zero e o selo some', async () => {
    setup(numberedNotifications(3, { is_read: true }));

    const button = await bell('Notificações, 0 não lidas');

    expect(within(button).queryByText('0')).not.toBeInTheDocument();
  });

  it('com uma só não lida o rótulo está no singular', async () => {
    setup(numberedNotifications(1));

    expect(await bell('Notificações, 1 não lida')).toBeVisible();
  });
});

describe('Sino: o painel', () => {
  it('abre com as 10 mais recentes, "Marcar todas como lidas" e "Ver todas"', async () => {
    const { fetchMock, events } = setup(numberedNotifications(15));

    const panel = await openPanel(events);

    expect(await within(panel).findByText('Notificação 15')).toBeVisible();
    expect(within(panel).getAllByRole('listitem')).toHaveLength(10);
    expect(within(panel).queryByText('Notificação 5')).not.toBeInTheDocument();
    const query = requestsTo(fetchMock, LIST).at(-1)![0];
    const url = new URL(String(query), 'http://localhost');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(
      within(panel).getByRole('button', { name: 'Marcar todas como lidas' }),
    ).toBeEnabled();
    expect(
      within(panel).getByRole('link', { name: 'Ver todas' }),
    ).toHaveAttribute('href', '/aluno/notificacoes');
  });

  it('"Ver todas" leva o professor à página do professor e fecha o painel', async () => {
    const { events } = setup(numberedNotifications(2), { user: 'teacher' });
    const panel = await openPanel(events);

    await events.click(within(panel).getByRole('link', { name: 'Ver todas' }));

    await waitFor(() =>
      expect(location()).toHaveTextContent('/professor/notificacoes'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('cada item mostra a mensagem, a data relativa e o marcador de não lida em texto', async () => {
    const created = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { events } = setup([
      makeNotification(1, {
        message: 'Carlos criou a atividade "Capítulo 2" para você.',
        created_at: created,
      }),
    ]);
    const panel = await openPanel(events);

    const item = await firstItem(panel);

    expect(
      within(item).getByText(
        'Carlos criou a atividade "Capítulo 2" para você.',
      ),
    ).toBeVisible();
    expect(within(item).getByText('há 5 min')).toBeVisible();
    expect(within(item).getByText('Não lida')).toBeVisible();
  });

  it('a data completa fica no balão da data relativa', async () => {
    const created = '2026-11-09T15:00:00Z';
    const { events } = setup([makeNotification(1, { created_at: created })]);
    const panel = await openPanel(events);

    const item = await firstItem(panel);

    expect(
      within(item).getByLabelText('9 de novembro de 2026, às 12:00'),
    ).toBeInTheDocument();
  });

  it('as lidas não têm o marcador nem o botão "Marcar como lida"', async () => {
    const { events } = setup([makeNotification(1, { is_read: true })]);
    const panel = await openPanel(events);

    const item = await firstItem(panel);

    expect(within(item).queryByText('Não lida')).not.toBeInTheDocument();
    expect(
      within(item).queryByRole('button', { name: 'Marcar como lida' }),
    ).not.toBeInTheDocument();
  });

  it('mostra os campos alterados de uma atividade (RF52)', async () => {
    const { events } = setup([
      makeNotification(1, {
        type: 'activity_changed',
        message: 'Carlos alterou a atividade "Capítulo 2".',
        payload: {
          changes: [
            { field: 'title', old: 'Capítulo', new: 'Capítulo 2' },
            { field: 'deadline', old: '2026-11-20', new: '2026-12-31' },
          ],
        },
      }),
    ]);
    const panel = await openPanel(events);

    const item = await firstItem(panel);

    expect(
      within(item).getByText('Título: de “Capítulo” para “Capítulo 2”'),
    ).toBeVisible();
    expect(
      within(item).getByText(
        'Prazo: de “20 de novembro de 2026” para “31 de dezembro de 2026”',
      ),
    ).toBeVisible();
  });

  it('mostra as quantidades da orientação encerrada (RF53)', async () => {
    const { events } = setup([
      makeNotification(1, {
        type: 'advising_ended',
        message: 'Carlos encerrou a sua orientação.',
        reference: { type: 'advising', id: 3 },
        payload: { archived_activities: 2, cancelled_meetings: 1 },
      }),
    ]);
    const panel = await openPanel(events);

    const item = await firstItem(panel);

    expect(within(item).getByText('Atividades arquivadas: 2')).toBeVisible();
    expect(within(item).getByText('Reuniões canceladas: 1')).toBeVisible();
  });

  it('um tipo desconhecido mostra a mensagem, sem quebrar a tela nem ter destino', async () => {
    const { events } = setup([
      makeNotification(1, {
        type: 'um_tipo_do_futuro',
        message: 'Algo novo aconteceu.',
        payload: { qualquer: ['coisa', 1, null] },
      }),
    ]);
    const panel = await openPanel(events);

    const item = await firstItem(panel);

    expect(within(item).getByText('Algo novo aconteceu.')).toBeVisible();
    expect(
      within(item).queryByRole('button', { name: /Algo novo/ }),
    ).not.toBeInTheDocument();
    expect(
      within(item).getByRole('button', { name: 'Marcar como lida' }),
    ).toBeVisible();
  });

  it('sem notificações mostra um estado vazio informativo', async () => {
    const { events } = setup([]);
    const panel = await openPanel(events);

    expect(
      await within(panel).findByText('Você não tem notificações.'),
    ).toBeVisible();
  });

  it('mostra um esqueleto enquanto carrega', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { events } = setup(numberedNotifications(2), {
      overrides: {
        [LIST]: async () => {
          await gate;
          return { body: { items: numberedNotifications(2), count: 2 } };
        },
      },
    });
    const panel = await openPanel(events);

    expect(
      await within(panel).findByTestId('notifications-skeleton'),
    ).toBeInTheDocument();
    release();

    expect(await within(panel).findByText('Notificação 2')).toBeVisible();
  });

  it('mostra um erro com "Tentar novamente" dentro do painel, que funciona', async () => {
    let failing = true;
    const { events } = setup(numberedNotifications(2), {
      overrides: {
        [LIST]: () =>
          failing
            ? { status: 500, body: {} }
            : { body: { items: numberedNotifications(2), count: 2 } },
      },
    });
    const panel = await openPanel(events);

    expect(
      await within(panel).findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    failing = false;
    await events.click(
      within(panel).getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await within(panel).findByText('Notificação 2')).toBeVisible();
  });

  it('o Esc fecha o painel e os itens são alcançáveis pelo teclado', async () => {
    const { events } = setup(numberedNotifications(2));
    const panel = await openPanel(events);
    await within(panel).findByText('Notificação 2');

    const items = within(panel).getAllByRole('button', { name: /Notificação/ });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items)
      expect(item).not.toHaveAttribute('tabindex', '-1');
    await events.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('no celular o painel abre e mostra as notificações', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { events } = setup(numberedNotifications(2));

    const panel = await openPanel(events);

    expect(await within(panel).findByText('Notificação 2')).toBeVisible();
  });
});

describe('Sino: ler e navegar', () => {
  it('clicar no item marca como lida, atualiza o selo na hora e leva ao destino', async () => {
    const { fetchMock, events } = setup([
      makeNotification(1, {
        type: 'activity_created',
        message: 'Nova atividade',
        reference: { type: 'activity', id: 42 },
      }),
    ]);
    const panel = await openPanel(events);

    await events.click(
      await within(panel).findByRole('button', { name: /Nova atividade/ }),
    );

    await waitFor(() =>
      expect(location()).toHaveTextContent('/aluno/atividades/42'),
    );
    expect(
      requestsTo(fetchMock, 'PATCH /api/notificacoes/1/lida'),
    ).toHaveLength(1);
    expect(await bell('Notificações, 0 não lidas')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it.each([
    ['advising_request_received', 'teacher', '/professor/solicitacoes', null],
    ['advising_request_answered', 'student', '/aluno/solicitacao', null],
    ['advising_ended', 'student', '/aluno/solicitacao', null],
    [
      'meeting_requested',
      'student',
      '/aluno/reunioes',
      { type: 'meeting', id: 5 },
    ],
    [
      'meeting_answered',
      'teacher',
      '/professor/reunioes',
      { type: 'meeting', id: 5 },
    ],
    [
      'activity_commented',
      'teacher',
      '/professor/atividades/42',
      { type: 'activity', id: 42 },
    ],
    [
      'activity_review_result',
      'student',
      '/aluno/atividades/42',
      { type: 'activity', id: 42 },
    ],
  ] as const)(
    'o tipo %s do %s leva a %s',
    async (type, user, destination, reference) => {
      const { events } = setup(
        [makeNotification(1, { type, message: 'Aviso', reference })],
        { user },
      );
      const panel = await openPanel(events);

      await events.click(
        await within(panel).findByRole('button', { name: /Aviso/ }),
      );

      await waitFor(() => expect(location()).toHaveTextContent(destination));
    },
  );

  it('a atividade excluída não tem link, mas pode ser marcada como lida (RF52)', async () => {
    const { fetchMock, events } = setup([
      makeNotification(1, {
        type: 'activity_deleted',
        message: 'Carlos excluiu a atividade "Capítulo 2".',
      }),
    ]);
    const panel = await openPanel(events);
    const item = await firstItem(panel);

    expect(
      within(item).queryByRole('button', { name: /excluiu/ }),
    ).not.toBeInTheDocument();
    await events.click(
      within(item).getByRole('button', { name: 'Marcar como lida' }),
    );

    await waitFor(() =>
      expect(
        requestsTo(fetchMock, 'PATCH /api/notificacoes/1/lida'),
      ).toHaveLength(1),
    );
    expect(location()).toHaveTextContent('/aluno/dashboard');
  });

  it('"Marcar como lida" marca sem navegar e atualiza o selo na hora', async () => {
    const { events } = setup(numberedNotifications(3));
    const panel = await openPanel(events);
    const first = await firstItem(panel);

    await events.click(
      within(first).getByRole('button', { name: 'Marcar como lida' }),
    );

    expect(await bell('Notificações, 2 não lidas')).toBeVisible();
    expect(within(first).queryByText('Não lida')).not.toBeInTheDocument();
    expect(
      within(first).queryByRole('button', { name: 'Marcar como lida' }),
    ).not.toBeInTheDocument();
    expect(location()).toHaveTextContent('/aluno/dashboard');
  });

  it('se marcar uma como lida falha, o selo e o item voltam e o erro aparece', async () => {
    const { events } = setup(numberedNotifications(3), {
      overrides: {
        [READ_ONE]: { status: 500, body: {} },
      },
    });
    const panel = await openPanel(events);
    const first = await firstItem(panel);

    await events.click(
      within(first).getByRole('button', { name: 'Marcar como lida' }),
    );

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    expect(await bell('Notificações, 3 não lidas')).toBeVisible();
    expect(await within(first).findByText('Não lida')).toBeVisible();
  });

  it('"Marcar todas como lidas" zera o selo na hora e envia um pedido só', async () => {
    const { fetchMock, events } = setup(numberedNotifications(3));
    const panel = await openPanel(events);
    await within(panel).findByText('Notificação 3');

    await events.click(
      within(panel).getByRole('button', { name: 'Marcar todas como lidas' }),
    );

    expect(await bell('Notificações, 0 não lidas')).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, READ_ALL.replace('/:id', ''))).toHaveLength(
        1,
      ),
    );
    await waitFor(() =>
      expect(within(panel).queryByText('Não lida')).not.toBeInTheDocument(),
    );
    expect(
      within(panel).getByRole('button', { name: 'Marcar todas como lidas' }),
    ).toBeDisabled();
  });

  it('se marcar todas falha, o selo volta ao total de antes e o erro aparece', async () => {
    const { events } = setup(numberedNotifications(3), {
      overrides: { [READ_ALL]: { status: 500, body: {} } },
    });
    const panel = await openPanel(events);
    await within(panel).findByText('Notificação 3');

    await events.click(
      within(panel).getByRole('button', { name: 'Marcar todas como lidas' }),
    );

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    expect(await bell('Notificações, 3 não lidas')).toBeVisible();
    expect(within(panel).getAllByText('Não lida')).toHaveLength(3);
  });
});

describe('Sino: a consulta periódica da contagem (ADR 0003)', () => {
  it('consulta ao abrir e de novo quando a aba volta a ficar visível, e o selo acompanha', async () => {
    const { fetchMock, server } = setup(numberedNotifications(1));
    await bell('Notificações, 1 não lida');
    const before = requestsTo(fetchMock, COUNT).length;
    server.receive(makeNotification(9, { message: 'Chegou agora' }));

    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));

    expect(await bell('Notificações, 2 não lidas')).toBeVisible();
    expect(requestsTo(fetchMock, COUNT).length).toBeGreaterThan(before);
  });

  it('com a aba oculta não consulta', async () => {
    const { fetchMock } = setup(numberedNotifications(1));
    await bell('Notificações, 1 não lida');
    const before = requestsTo(fetchMock, COUNT).length;

    act(() => setVisibility('hidden'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(requestsTo(fetchMock, COUNT).length).toBe(before);
  });

  it('uma consulta que falha não mostra erro e mantém o último total', async () => {
    let failing = false;
    const { server } = setup(numberedNotifications(2), {
      path: '/aluno/notificacoes',
      overrides: {
        [COUNT]: () =>
          failing ? { status: 500, body: {} } : { body: { count: 2 } },
      },
    });
    await bell('Notificações, 2 não lidas');
    server.receive(makeNotification(9));
    failing = true;

    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(await bell('Notificações, 2 não lidas')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ocorreu um erro/)).not.toBeInTheDocument();
  });

  it('com o painel aberto e a contagem subindo, a lista é relida', async () => {
    const { events, server } = setup(numberedNotifications(2));
    const panel = await openPanel(events);
    await within(panel).findByText('Notificação 2');
    server.receive(makeNotification(9, { message: 'Chegou agora' }));

    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));

    expect(await within(panel).findByText('Chegou agora')).toBeVisible();
    expect(within(panel).getByText('Notificação 2')).toBeVisible();
  });

  it('para ao sair da sessão: nenhuma consulta depois do logout', async () => {
    const { fetchMock, events } = setup(numberedNotifications(1));
    await bell('Notificações, 1 não lida');

    await events.click(screen.getByRole('button', { name: 'Sair' }));
    await screen.findByRole('heading', { name: 'Entrar' });
    const before = requestsTo(fetchMock, COUNT).length;
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(requestsTo(fetchMock, COUNT).length).toBe(before);
    expect(
      screen.queryByRole('button', { name: /Notificações/ }),
    ).not.toBeInTheDocument();
  });
});

describe('Página de notificações', () => {
  it('lista tudo, paginado, com a página na URL', async () => {
    const { fetchMock, events } = setup(numberedNotifications(45), {
      path: '/aluno/notificacoes',
    });

    await screen.findByRole('heading', { level: 1, name: 'Notificações' });
    const list = await screen.findByRole('list', { name: 'Notificações' });

    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(within(list).getByText('Notificação 45')).toBeVisible();
    await events.click(
      screen.getByRole('button', { name: 'Ir para a página 2' }),
    );

    await waitFor(() => expect(location()).toHaveTextContent('pagina=2'));
    expect(await screen.findByText('Notificação 25')).toBeVisible();
    const last = requestsTo(fetchMock, LIST).at(-1)![0];
    expect(
      new URL(String(last), 'http://localhost').searchParams.get('offset'),
    ).toBe('20');
  });

  it('abre direto na página e no filtro que estão na URL', async () => {
    setup(numberedNotifications(45), {
      path: '/aluno/notificacoes?pagina=3',
    });

    expect(await screen.findByText('Notificação 5')).toBeVisible();
    expect(screen.queryByText('Notificação 25')).not.toBeInTheDocument();
  });

  it('o filtro "Somente não lidas" pede só as não lidas, fica na URL e volta à primeira página', async () => {
    const notifications = [
      ...numberedNotifications(30).map((item) => ({
        ...item,
        id: item.id + 100,
        is_read: true,
      })),
      ...numberedNotifications(2),
    ];
    const { fetchMock, events } = setup(notifications, {
      path: '/aluno/notificacoes?pagina=2',
    });
    await screen.findByRole('heading', { level: 1, name: 'Notificações' });

    await events.click(
      screen.getByRole('checkbox', { name: 'Somente não lidas' }),
    );

    await waitFor(() => expect(location()).toHaveTextContent('nao-lidas=1'));
    expect(location()).not.toHaveTextContent('pagina');
    const list = await screen.findByRole('list', { name: 'Notificações' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    const last = requestsTo(fetchMock, LIST).at(-1)![0];
    expect(
      new URL(String(last), 'http://localhost').searchParams.get('is_read'),
    ).toBe('false');
  });

  it('abre direto com o filtro da URL marcado', async () => {
    setup(numberedNotifications(3), {
      path: '/aluno/notificacoes?nao-lidas=1',
    });

    expect(
      await screen.findByRole('checkbox', { name: 'Somente não lidas' }),
    ).toBeChecked();
  });

  it('sem notificações mostra o estado vazio, e com o filtro mostra o dele', async () => {
    const { events } = setup([], { path: '/aluno/notificacoes' });

    expect(await screen.findByText('Você não tem notificações.')).toBeVisible();
    await events.click(
      screen.getByRole('checkbox', { name: 'Somente não lidas' }),
    );

    expect(
      await screen.findByText('Nenhuma notificação não lida.'),
    ).toBeVisible();
  });

  it('"Marcar todas como lidas" na página atualiza o selo, e com o filtro a lista esvazia', async () => {
    const { events } = setup(numberedNotifications(3), {
      path: '/aluno/notificacoes?nao-lidas=1',
    });
    await screen.findByText('Notificação 3');

    await events.click(
      screen.getByRole('button', { name: 'Marcar todas como lidas' }),
    );

    expect(await bell('Notificações, 0 não lidas')).toBeVisible();
    expect(
      await screen.findByText('Nenhuma notificação não lida.'),
    ).toBeVisible();
  });

  it('o professor abre a página dele, pelo sino, não pelo menu lateral', async () => {
    setup(numberedNotifications(2), {
      user: 'teacher',
      path: '/professor/notificacoes',
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notificações' }),
    ).toBeVisible();
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu).queryByRole('link', { name: 'Notificações' }),
    ).not.toBeInTheDocument();
  });

  it('um erro ao listar mostra "Tentar novamente", que funciona', async () => {
    let failing = true;
    const { events } = setup(numberedNotifications(2), {
      path: '/aluno/notificacoes',
      overrides: {
        [LIST]: () =>
          failing
            ? { status: 500, body: {} }
            : { body: { items: numberedNotifications(2), count: 2 } },
      },
    });

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    failing = false;
    await events.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Notificação 2')).toBeVisible();
  });
});
