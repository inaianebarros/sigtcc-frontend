import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import {
  TEACHER_ME,
  makeAttentionAdvisee,
  makeDeadline,
  makeEmptyTeacherDashboard,
  makeTeacherDashboard,
  teacherDashboardRoutes,
} from '../test/dashboardApi';
import type { FakeTeacherDashboard } from '../test/dashboardApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const DASHBOARD = 'GET /api/painel/professor';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup(
  initial: FakeTeacherDashboard = makeTeacherDashboard(),
  {
    path = '/professor/dashboard',
    overrides = {},
  }: { path?: string; overrides?: Overrides } = {},
) {
  let current = initial;
  const fetchMock = mockApi(
    teacherDashboardRoutes(() => current, TEACHER_ME, overrides as never),
  );
  const events = userEvent.setup({ applyAccept: false });
  renderApp(path);
  return {
    fetchMock,
    events,
    serve: (next: FakeTeacherDashboard) => {
      current = next;
    },
  };
}

const heading = () =>
  screen.findByRole('heading', { level: 1, name: 'Dashboard' });

const attention = () =>
  screen.findByRole('region', {
    name: 'Orientandos que precisam de atenção',
  });

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Dashboard do professor: a navegação', () => {
  it('é o primeiro item do menu e a tela inicial da área do professor', async () => {
    setup(makeTeacherDashboard(), { path: '/professor' });

    await heading();

    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    const links = within(menu).getAllByRole('link');
    expect(links[0]).toHaveTextContent('Dashboard');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
  });

  it('o item Dashboard não exige orientando ativo', async () => {
    setup(makeEmptyTeacherDashboard());

    await heading();

    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(within(menu).getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });
});

describe('Dashboard do professor: com orientações ativas', () => {
  it('mostra o título e a saudação', async () => {
    setup();

    await heading();

    expect(screen.getByText(/Olá, Carlos Lima/)).toBeVisible();
  });

  it('mostra os indicadores com os números reais da API', async () => {
    setup();

    const region = await screen.findByRole('region', {
      name: 'Indicadores das orientações',
    });

    const expected: [string, string][] = [
      ['Orientandos ativos', '2'],
      ['Total de atividades', '10'],
      ['Pendentes', '3'],
      ['Em andamento', '2'],
      ['Aguardando revisão', '2'],
      ['Concluídas', '3'],
      ['Atrasadas', '2'],
    ];
    for (const [label, value] of expected) {
      const card = within(region).getByRole('group', { name: label });
      expect(within(card).getByText(value)).toBeVisible();
    }
  });

  it('mostra o progresso geral das orientações em barra e percentual', async () => {
    setup();

    const region = await screen.findByRole('region', {
      name: 'Progresso geral',
    });

    expect(within(region).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '30',
    );
    expect(within(region).getByText('30%')).toBeVisible();
  });

  it('a lista de atenção segue a ordem da API e mostra os dados de cada orientando', async () => {
    setup();

    const region = await attention();

    const [maria, joao] = within(region).getAllByRole('listitem');
    expect(
      within(maria!).getByRole('link', { name: 'Maria Lima' }),
    ).toHaveAttribute('href', '/professor/alunos/101');
    expect(within(maria!).getByText(/Redes neurais em saúde/)).toBeVisible();
    expect(within(maria!).getByText('2 atrasadas')).toBeVisible();
    expect(within(maria!).getByText('1 em revisão')).toBeVisible();
    expect(
      within(joao!).getByRole('link', { name: 'João Souza' }),
    ).toHaveAttribute('href', '/professor/alunos/102');
    expect(
      within(joao!).getByText(/Tema do TCC ainda não cadastrado/),
    ).toBeVisible();
    expect(within(joao!).getByText('Sem atrasadas')).toBeVisible();
    expect(within(joao!).getByText('1 em revisão')).toBeVisible();
  });

  it('cada orientando de atenção leva às atividades dele, com o filtro na URL', async () => {
    setup();

    const region = await attention();

    const [maria] = within(region).getAllByRole('listitem');
    expect(
      within(maria!).getByRole('link', { name: 'Ver atividades' }),
    ).toHaveAttribute('href', '/professor/atividades?aluno=101');
  });

  it('usa o singular quando há uma só atividade atrasada', async () => {
    setup(
      makeTeacherDashboard({
        attention_advisees: {
          items: [
            makeAttentionAdvisee(101, { overdue_count: 1, in_review_count: 0 }),
          ],
          has_more: false,
        },
      }),
    );

    const region = await attention();

    expect(within(region).getByText('1 atrasada')).toBeVisible();
  });

  it('oferece "Ver todos os orientandos" só quando há mais itens que o limite', async () => {
    setup(
      makeTeacherDashboard({
        attention_advisees: {
          items: [makeAttentionAdvisee(101)],
          has_more: true,
        },
      }),
    );

    const region = await attention();

    expect(
      within(region).getByRole('link', { name: 'Ver todos os orientandos' }),
    ).toHaveAttribute('href', '/professor/orientandos');
  });

  it('sem "mais" não oferece "Ver todos os orientandos"', async () => {
    setup();

    const region = await attention();

    expect(
      within(region).queryByRole('link', { name: 'Ver todos os orientandos' }),
    ).not.toBeInTheDocument();
  });

  it('sem orientandos de atenção mostra um estado vazio informativo', async () => {
    setup(
      makeTeacherDashboard({
        attention_advisees: { items: [], has_more: false },
      }),
    );

    const region = await attention();

    expect(
      within(region).getByText('Nenhum orientando precisa de atenção agora.'),
    ).toBeVisible();
  });

  it('lista os próximos prazos com título, orientando, prazo, situação e o selo de atraso', async () => {
    setup();

    const region = await screen.findByRole('region', {
      name: 'Próximos prazos',
    });

    const [late, onTime] = within(region).getAllByRole('listitem');
    expect(
      within(late!).getByRole('link', { name: 'Capítulo 1' }),
    ).toHaveAttribute('href', '/professor/atividades/21');
    expect(within(late!).getByText(/Maria Lima/)).toBeVisible();
    expect(within(late!).getByText(/1 de novembro de 2026/)).toBeVisible();
    expect(within(late!).getByText('Atrasada')).toBeVisible();
    expect(within(late!).getByText('Em andamento')).toBeVisible();
    expect(within(onTime!).getByText(/João Souza/)).toBeVisible();
    expect(within(onTime!).queryByText('Atrasada')).not.toBeInTheDocument();
  });

  it('oferece "Ver todas" nos prazos só quando há mais itens que o limite', async () => {
    setup(
      makeTeacherDashboard({
        next_deadlines: { items: [makeDeadline(1)], has_more: true },
      }),
    );

    const region = await screen.findByRole('region', {
      name: 'Próximos prazos',
    });

    expect(
      within(region).getByRole('link', { name: 'Ver todas' }),
    ).toHaveAttribute('href', '/professor/atividades');
  });

  it('sem prazos em aberto mostra um estado vazio informativo', async () => {
    setup(
      makeTeacherDashboard({
        next_deadlines: { items: [], has_more: false },
      }),
    );

    const region = await screen.findByRole('region', {
      name: 'Próximos prazos',
    });

    expect(
      within(region).getByText('Nenhuma atividade em aberto.'),
    ).toBeVisible();
  });

  it('dá acesso às solicitações recebidas, aos orientandos e às atividades', async () => {
    setup();

    const region = await screen.findByRole('region', {
      name: 'Acessos rápidos',
    });

    expect(
      within(region).getByRole('link', { name: 'Solicitações recebidas' }),
    ).toHaveAttribute('href', '/professor/solicitacoes');
    expect(
      within(region).getByRole('link', { name: 'Orientandos' }),
    ).toHaveAttribute('href', '/professor/orientandos');
    expect(
      within(region).getByRole('link', { name: 'Atividades' }),
    ).toHaveAttribute('href', '/professor/atividades');
  });

  it('os links do perfil e das atividades de um orientando levam às telas existentes', async () => {
    const { events } = setup();
    const region = await attention();
    const [maria] = within(region).getAllByRole('listitem');

    await events.click(
      within(maria!).getByRole('link', { name: 'Ver atividades' }),
    );

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/professor/atividades?aluno=101',
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Atividades' }),
    ).toBeVisible();
  });

  it('o nome do orientando leva ao perfil dele', async () => {
    const { events } = setup();
    const region = await attention();

    await events.click(
      within(region).getByRole('link', { name: 'Maria Lima' }),
    );

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/professor/alunos/101',
    );
  });

  it('funciona no celular, com os mesmos blocos', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup();

    await heading();

    expect(
      await screen.findByRole('region', {
        name: 'Indicadores das orientações',
      }),
    ).toBeVisible();
    expect(await attention()).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Próximos prazos' }),
    ).toBeVisible();
  });
});

describe('Dashboard do professor: casos sem dados', () => {
  it('sem orientações ativas mostra um estado vazio, sem indicadores, e ainda dá acesso às solicitações', async () => {
    setup(makeEmptyTeacherDashboard());

    expect(
      await screen.findByText(/Você ainda não tem orientandos ativos/),
    ).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Indicadores das orientações' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', {
        name: 'Orientandos que precisam de atenção',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Próximos prazos' }),
    ).not.toBeInTheDocument();
    const quick = screen.getByRole('region', { name: 'Acessos rápidos' });
    expect(
      within(quick).getByRole('link', { name: 'Solicitações recebidas' }),
    ).toBeVisible();
  });

  it('com orientandos mas sem atividades mostra só o número de orientandos e o estado vazio', async () => {
    setup(
      makeTeacherDashboard({
        activities: {
          total: 0,
          pending: 0,
          in_progress: 0,
          in_review: 0,
          completed: 0,
          overdue: 0,
          progress_percent: null,
        },
        attention_advisees: { items: [], has_more: false },
        next_deadlines: { items: [], has_more: false },
      }),
    );

    expect(
      await screen.findByText(
        'Os seus orientandos ainda não possuem atividades cadastradas.',
      ),
    ).toBeVisible();
    const region = screen.getByRole('region', {
      name: 'Indicadores das orientações',
    });
    expect(
      within(region).getByRole('group', { name: 'Orientandos ativos' }),
    ).toBeVisible();
    expect(
      within(region).queryByRole('group', { name: 'Total de atividades' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });
});

describe('Dashboard do professor: carregamento e erros', () => {
  it('mostra um esqueleto enquanto carrega', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setup(makeTeacherDashboard(), {
      overrides: {
        [DASHBOARD]: async () => {
          await gate;
          return { body: makeTeacherDashboard() };
        },
      },
    });

    expect(await screen.findByTestId('dashboard-skeleton')).toBeInTheDocument();
    release();

    await attention();
    expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
  });

  it('mostra um erro simples com "Tentar novamente", que funciona', async () => {
    let failing = true;
    const { events } = setup(makeTeacherDashboard(), {
      overrides: {
        [DASHBOARD]: () =>
          failing
            ? { status: 500, body: {} }
            : { body: makeTeacherDashboard() },
      },
    });

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    failing = false;
    await events.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await attention()).toBeVisible();
  });
});

describe('Dashboard do professor: atualização ao voltar o foco', () => {
  it('relê ao voltar o foco para a aba e mostra os novos números, sem esqueleto', async () => {
    const { fetchMock, serve } = setup();
    const progress = await screen.findByRole('region', {
      name: 'Progresso geral',
    });
    expect(within(progress).getByText('30%')).toBeVisible();
    const before = requestsTo(fetchMock, DASHBOARD).length;
    serve(
      makeTeacherDashboard({
        activities: {
          total: 10,
          pending: 2,
          in_progress: 2,
          in_review: 1,
          completed: 5,
          overdue: 0,
          progress_percent: 50,
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
    expect(await screen.findByText('50%')).toBeVisible();
  });
});
