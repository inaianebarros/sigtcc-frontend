import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import {
  STUDENT_ME,
  makeDashboardActivity,
  makeDashboardWithoutAdvising,
  makeStudentDashboard,
  studentDashboardRoutes,
} from '../test/dashboardApi';
import type { FakeStudentDashboard } from '../test/dashboardApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const DASHBOARD = 'GET /api/painel/aluno';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup(
  initial: FakeStudentDashboard = makeStudentDashboard(),
  {
    path = '/aluno/dashboard',
    overrides = {},
  }: { path?: string; overrides?: Overrides } = {},
) {
  let current = initial;
  const fetchMock = mockApi(
    studentDashboardRoutes(() => current, STUDENT_ME, overrides as never),
  );
  const events = userEvent.setup({ applyAccept: false });
  renderApp(path);
  return {
    fetchMock,
    events,
    serve: (next: FakeStudentDashboard) => {
      current = next;
    },
  };
}

const heading = () =>
  screen.findByRole('heading', { level: 1, name: 'Dashboard' });

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Dashboard do aluno: a navegação', () => {
  it('é o primeiro item do menu e a tela inicial da área do aluno', async () => {
    setup(makeStudentDashboard(), { path: '/aluno' });

    await heading();

    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    const links = within(menu).getAllByRole('link');
    expect(links[0]).toHaveTextContent('Dashboard');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
  });

  it('o item Dashboard não exige orientação ativa', async () => {
    setup(makeDashboardWithoutAdvising(), { path: '/aluno/dashboard' });

    await heading();

    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(within(menu).getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });
});

describe('Dashboard do aluno: com orientação ativa', () => {
  it('mostra o título, a saudação e o card da orientação com o tema e o orientador', async () => {
    setup();

    await heading();

    expect(screen.getByText(/Olá, Ana Souza/)).toBeVisible();
    const card = await screen.findByRole('region', { name: 'Orientação' });
    expect(within(card).getByText('Redes neurais em saúde')).toBeVisible();
    expect(
      within(card).getByRole('link', { name: 'Carlos Lima' }),
    ).toHaveAttribute('href', '/aluno/orientadores/9');
  });

  it('sem tema cadastrado diz isso e leva ao cadastro', async () => {
    setup(
      makeStudentDashboard({
        advising: {
          teacher: { id: 9, full_name: 'Carlos Lima' },
          thesis_topic: null,
        },
      }),
    );

    const card = await screen.findByRole('region', { name: 'Orientação' });

    expect(
      within(card).getByText(/Tema do TCC ainda não cadastrado/),
    ).toBeVisible();
    expect(
      within(card).getByRole('link', { name: 'Cadastrar tema' }),
    ).toHaveAttribute('href', '/aluno/tema');
  });

  it('mostra os indicadores com os números reais da API', async () => {
    setup();

    const region = await screen.findByRole('region', {
      name: 'Indicadores das atividades',
    });

    const expected: [string, string][] = [
      ['Total de atividades', '5'],
      ['Pendentes', '2'],
      ['Em andamento', '1'],
      ['Em revisão', '1'],
      ['Concluídas', '1'],
      ['Atrasadas', '1'],
    ];
    for (const [label, value] of expected) {
      const card = within(region).getByRole('group', { name: label });
      expect(within(card).getByText(value)).toBeVisible();
    }
  });

  it('mostra o progresso geral em barra e percentual', async () => {
    setup();

    const region = await screen.findByRole('region', {
      name: 'Progresso geral',
    });

    const bar = within(region).getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '20');
    expect(within(region).getByText('20%')).toBeVisible();
  });

  it('lista as próximas atividades com título, prazo, situação e links para os detalhes', async () => {
    setup();

    const region = await screen.findByRole('region', {
      name: 'Próximas atividades',
    });

    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(
      within(items[0]!).getByRole('link', { name: 'Capítulo 1' }),
    ).toHaveAttribute('href', '/aluno/atividades/11');
    expect(within(items[0]!).getByText(/1 de novembro de 2026/)).toBeVisible();
    expect(within(items[1]!).getByText(/15 de dezembro de 2026/)).toBeVisible();
    expect(within(items[1]!).getByText('Pendente')).toBeVisible();
  });

  it('a atividade atrasada mostra o selo Atrasada e mantém a situação original', async () => {
    setup();

    const region = await screen.findByRole('region', {
      name: 'Próximas atividades',
    });

    const [late, onTime] = within(region).getAllByRole('listitem');
    expect(within(late!).getByText('Atrasada')).toBeVisible();
    expect(within(late!).getByText('Em andamento')).toBeVisible();
    expect(within(onTime!).queryByText('Atrasada')).not.toBeInTheDocument();
  });

  it('oferece "Ver todas" só quando há mais atividades que o limite', async () => {
    const { serve } = setup(
      makeStudentDashboard({
        next_activities: {
          items: [makeDashboardActivity(1)],
          has_more: true,
        },
      }),
    );
    const region = await screen.findByRole('region', {
      name: 'Próximas atividades',
    });

    expect(
      within(region).getByRole('link', { name: 'Ver todas' }),
    ).toHaveAttribute('href', '/aluno/atividades');
    serve(makeStudentDashboard());
  });

  it('sem "mais" não oferece "Ver todas"', async () => {
    setup();

    const region = await screen.findByRole('region', {
      name: 'Próximas atividades',
    });

    expect(
      within(region).queryByRole('link', { name: 'Ver todas' }),
    ).not.toBeInTheDocument();
  });

  it('sem atividades mostra o estado vazio, sem percentual nem indicadores', async () => {
    setup(
      makeStudentDashboard({
        activities: {
          total: 0,
          pending: 0,
          in_progress: 0,
          in_review: 0,
          completed: 0,
          overdue: 0,
          progress_percent: null,
        },
        next_activities: { items: [], has_more: false },
      }),
    );

    await heading();

    expect(
      await screen.findByText('Você ainda não possui atividades cadastradas.'),
    ).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Indicadores das atividades' }),
    ).not.toBeInTheDocument();
  });

  it('com atividades mas nenhuma em aberto mostra o progresso e uma lista vazia informativa', async () => {
    setup(
      makeStudentDashboard({
        activities: {
          total: 2,
          pending: 0,
          in_progress: 0,
          in_review: 0,
          completed: 2,
          overdue: 0,
          progress_percent: 100,
        },
        next_activities: { items: [], has_more: false },
      }),
    );

    const progress = await screen.findByRole('region', {
      name: 'Progresso geral',
    });

    expect(within(progress).getByText('100%')).toBeVisible();
    const next = screen.getByRole('region', { name: 'Próximas atividades' });
    expect(
      within(next).getByText('Nenhuma atividade em aberto.'),
    ).toBeVisible();
  });

  it('funciona no celular, com os mesmos blocos', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup();

    await heading();

    expect(
      await screen.findByRole('region', { name: 'Orientação' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Indicadores das atividades' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Próximas atividades' }),
    ).toBeVisible();
  });
});

describe('Dashboard do aluno: sem orientação ativa', () => {
  it('explica a situação e leva à pesquisa de orientadores', async () => {
    setup(makeDashboardWithoutAdvising());

    const region = await screen.findByRole('region', {
      name: 'Sem orientação ativa',
    });

    expect(
      within(region).getByText(/Você ainda não tem uma orientação ativa/),
    ).toBeVisible();
    expect(
      within(region).getByRole('link', { name: 'Pesquisar orientadores' }),
    ).toHaveAttribute('href', '/aluno/orientadores');
    expect(
      screen.queryByRole('region', { name: 'Indicadores das atividades' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it.each([
    ['pending', /Sua solicitação para Carlos Lima aguarda resposta/],
    ['rejected', /Sua solicitação para Carlos Lima foi recusada/],
    ['unanswered', /Sua solicitação para Carlos Lima não foi respondida/],
  ] as const)(
    'mostra o estado da última solicitação %s',
    async (status, text) => {
      setup(
        makeDashboardWithoutAdvising({
          last_request: {
            id: 1,
            status,
            requested_at: '2026-11-05T12:00:00Z',
            teacher: { id: 9, full_name: 'Carlos Lima' },
          },
        }),
      );

      const region = await screen.findByRole('region', {
        name: 'Sem orientação ativa',
      });

      expect(within(region).getByText(text)).toBeVisible();
      expect(
        within(region).getByRole('link', { name: 'Ver minha solicitação' }),
      ).toHaveAttribute('href', '/aluno/solicitacao');
    },
  );

  it('com solicitação pendente não oferece a pesquisa de orientadores', async () => {
    setup(
      makeDashboardWithoutAdvising({
        last_request: {
          id: 1,
          status: 'pending',
          requested_at: '2026-11-05T12:00:00Z',
          teacher: { id: 9, full_name: 'Carlos Lima' },
        },
      }),
    );

    const region = await screen.findByRole('region', {
      name: 'Sem orientação ativa',
    });

    expect(
      within(region).queryByRole('link', { name: 'Pesquisar orientadores' }),
    ).not.toBeInTheDocument();
  });

  it.each(['rejected', 'unanswered'] as const)(
    'com a solicitação %s oferece pesquisar de novo',
    async (status) => {
      setup(
        makeDashboardWithoutAdvising({
          last_request: {
            id: 1,
            status,
            requested_at: '2026-11-05T12:00:00Z',
            teacher: { id: 9, full_name: 'Carlos Lima' },
          },
        }),
      );

      const region = await screen.findByRole('region', {
        name: 'Sem orientação ativa',
      });

      expect(
        within(region).getByRole('link', { name: 'Pesquisar orientadores' }),
      ).toBeVisible();
    },
  );

  it('mostra o link do histórico só quando existem orientações encerradas', async () => {
    const { serve } = setup(
      makeDashboardWithoutAdvising({ has_ended_advisings: true }),
    );
    const region = await screen.findByRole('region', {
      name: 'Sem orientação ativa',
    });

    expect(
      within(region).getByRole('link', {
        name: 'Ver histórico de orientações',
      }),
    ).toHaveAttribute('href', '/aluno/historico');
    serve(makeDashboardWithoutAdvising());
  });

  it('sem orientações encerradas não mostra o link do histórico', async () => {
    setup(makeDashboardWithoutAdvising());

    const region = await screen.findByRole('region', {
      name: 'Sem orientação ativa',
    });

    expect(
      within(region).queryByRole('link', {
        name: 'Ver histórico de orientações',
      }),
    ).not.toBeInTheDocument();
  });

  it('o link do histórico abre uma tela, mesmo que ainda em breve', async () => {
    const { events } = setup(
      makeDashboardWithoutAdvising({ has_ended_advisings: true }),
    );

    await events.click(
      await screen.findByRole('link', { name: 'Ver histórico de orientações' }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Histórico de orientações',
      }),
    ).toBeVisible();
  });
});

describe('Dashboard do aluno: carregamento e erros', () => {
  it('mostra um esqueleto enquanto carrega', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setup(makeStudentDashboard(), {
      overrides: {
        [DASHBOARD]: async () => {
          await gate;
          return { body: makeStudentDashboard() };
        },
      },
    });

    expect(await screen.findByTestId('dashboard-skeleton')).toBeInTheDocument();
    release();

    await screen.findByRole('region', { name: 'Orientação' });
    expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
  });

  it('mostra um erro simples com "Tentar novamente", que funciona', async () => {
    let failing = true;
    const { events } = setup(makeStudentDashboard(), {
      overrides: {
        [DASHBOARD]: () =>
          failing
            ? { status: 500, body: {} }
            : { body: makeStudentDashboard() },
      },
    });

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    failing = false;
    await events.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(
      await screen.findByRole('region', { name: 'Orientação' }),
    ).toBeVisible();
  });
});

describe('Dashboard do aluno: atualização ao voltar o foco', () => {
  it('relê ao voltar o foco para a aba e mostra os novos números, sem esqueleto', async () => {
    const { fetchMock, serve } = setup();
    const progress = await screen.findByRole('region', {
      name: 'Progresso geral',
    });
    expect(within(progress).getByText('20%')).toBeVisible();
    const before = requestsTo(fetchMock, DASHBOARD).length;
    serve(
      makeStudentDashboard({
        activities: {
          total: 5,
          pending: 1,
          in_progress: 1,
          in_review: 1,
          completed: 2,
          overdue: 0,
          progress_percent: 40,
        },
      }),
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(requestsTo(fetchMock, DASHBOARD).length).toBeGreaterThan(before),
    );
    expect(await screen.findByText('40%')).toBeVisible();
  });

  it('relê quando a aba volta a ficar visível', async () => {
    const { fetchMock } = setup();
    await screen.findByRole('region', { name: 'Orientação' });
    const before = requestsTo(fetchMock, DASHBOARD).length;

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() =>
      expect(requestsTo(fetchMock, DASHBOARD).length).toBeGreaterThan(before),
    );
  });

  it('um foco e uma aba visível quase juntos fazem uma leitura só', async () => {
    const { fetchMock } = setup();
    await screen.findByRole('region', { name: 'Orientação' });
    const before = requestsTo(fetchMock, DASHBOARD).length;

    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() =>
      expect(requestsTo(fetchMock, DASHBOARD).length).toBeGreaterThan(before),
    );
    expect(requestsTo(fetchMock, DASHBOARD).length).toBe(before + 1);
  });

  it('uma falha ao reler não derruba os dados que já estão na tela', async () => {
    let failing = false;
    const { fetchMock } = setup(makeStudentDashboard(), {
      overrides: {
        [DASHBOARD]: () =>
          failing
            ? { status: 500, body: {} }
            : { body: makeStudentDashboard() },
      },
    });
    await screen.findByRole('region', { name: 'Orientação' });
    failing = true;
    const before = requestsTo(fetchMock, DASHBOARD).length;

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() =>
      expect(requestsTo(fetchMock, DASHBOARD).length).toBeGreaterThan(before),
    );
    expect(screen.getByRole('region', { name: 'Orientação' })).toBeVisible();
  });
});
