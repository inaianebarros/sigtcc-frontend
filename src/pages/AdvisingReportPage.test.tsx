import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { makeEndedAdvising } from '../test/advisingHistoryApi';
import { makeAdvisingReport, reportRoutes } from '../test/advisingReportApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('AdvisingReportPage: o cabeçalho e os totais (RF61)', () => {
  it('o aluno abre o relatório e vê a outra parte, a situação, o tema, as datas e o motivo', async () => {
    mockApi(
      reportRoutes([
        makeAdvisingReport(7, {
          counterpart: { id: 50, full_name: 'Paulo Professor' },
          started_at: '2026-08-03T14:30:00Z',
          ended_at: '2026-11-02T14:30:00Z',
          reason: 'Concluímos o ciclo de orientação do TCC.',
          thesis_topic: 'Aprendizado de máquina na saúde',
        }),
      ]),
    );
    renderApp('/aluno/historico/7/relatorio');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Paulo Professor' }),
    ).toBeVisible();
    expect(screen.getByText('Encerrada')).toBeVisible();
    expect(screen.getByText('Tema da orientação')).toBeVisible();
    expect(screen.getByText('Aprendizado de máquina na saúde')).toBeVisible();
    expect(screen.getByText('03/08/2026')).toBeVisible();
    expect(screen.getByText('02/11/2026')).toBeVisible();
    expect(screen.getByText('Motivo do encerramento')).toBeVisible();
    expect(
      screen.getByText('Concluímos o ciclo de orientação do TCC.'),
    ).toBeVisible();
  });

  it('mostra "Sem tema cadastrado" quando a orientação não teve tema', async () => {
    mockApi(reportRoutes([makeAdvisingReport(7, { thesis_topic: null })]));
    renderApp('/aluno/historico/7/relatorio');

    expect(await screen.findByText('Sem tema cadastrado')).toBeVisible();
  });

  it('mostra os totais de registros, de reuniões e de atividades', async () => {
    mockApi(
      reportRoutes([
        makeAdvisingReport(7, {
          records_count: 9,
          meetings_count: 4,
          activities_count: 5,
        }),
      ]),
    );
    renderApp('/aluno/historico/7/relatorio');

    const records = await screen.findByRole('group', { name: 'Registros' });
    const meetings = screen.getByRole('group', { name: 'Reuniões' });
    const activities = screen.getByRole('group', { name: 'Atividades' });

    expect(within(records).getByText('9')).toBeVisible();
    expect(within(meetings).getByText('4')).toBeVisible();
    expect(within(activities).getByText('5')).toBeVisible();
  });

  it('o professor abre o relatório no endereço dele', async () => {
    mockApi(
      reportRoutes(
        [
          makeAdvisingReport(7, {
            counterpart: { id: 70, full_name: 'Ana Souza' },
          }),
        ],
        'teacher',
      ),
    );
    renderApp('/professor/historico/7/relatorio');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ana Souza' }),
    ).toBeVisible();
  });
});

describe('AdvisingReportPage: carregamento, erro e acesso negado', () => {
  it('enquanto carrega, mostra um esqueleto escondido do leitor de tela', async () => {
    mockApi(reportRoutes([makeAdvisingReport(7)]));
    renderApp('/aluno/historico/7/relatorio');

    expect(await screen.findByTestId('report-skeleton')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await screen.findByRole('heading', { level: 1, name: 'Pessoa 7' });
    expect(screen.queryByTestId('report-skeleton')).not.toBeInTheDocument();
  });

  it('mostra a mensagem de erro e tenta de novo', async () => {
    let calls = 0;
    const fetchMock = mockApi(
      reportRoutes([makeAdvisingReport(7)], 'student', () => {
        calls += 1;
        return calls === 1
          ? { status: 500, body: { detail: 'Falha no servidor.' } }
          : { body: makeAdvisingReport(7) };
      }),
    );
    const user = userEvent.setup();
    renderApp('/aluno/historico/7/relatorio');

    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pessoa 7' }),
    ).toBeVisible();
    expect(
      requestsTo(fetchMock, 'GET /api/orientacao/historico/7/relatorio'),
    ).toHaveLength(2);
  });

  it.each([
    [
      'uma orientação que não é do usuário, ativa ou inexistente',
      '/aluno/historico/99/relatorio',
    ],
    ['um id que não é um número', '/aluno/historico/abc/relatorio'],
    ['um id zero', '/aluno/historico/0/relatorio'],
  ])('%s leva à página "não encontrada"', async (_case, path) => {
    const fetchMock = mockApi(reportRoutes([makeAdvisingReport(7)]));
    renderApp(path);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Página não encontrada',
      }),
    ).toBeVisible();
    expect(screen.queryByText('Encerrada')).not.toBeInTheDocument();
    if (!path.includes('/99/')) {
      expect(
        requestsTo(fetchMock, 'GET /api/orientacao/historico/abc/relatorio'),
      ).toHaveLength(0);
    }
  });
});

describe('AdvisingReportPage: a volta ao histórico', () => {
  it('mostra a seta de voltar e o caminho "Histórico de orientações / Nome"', async () => {
    mockApi(reportRoutes([makeAdvisingReport(7)]));
    renderApp('/aluno/historico/7/relatorio');

    await screen.findByRole('heading', { level: 1, name: 'Pessoa 7' });
    const path = screen.getByRole('navigation', { name: 'Caminho' });

    expect(
      within(path).getByRole('link', { name: 'Histórico de orientações' }),
    ).toHaveAttribute('href', '/aluno/historico');
    expect(within(path).getByText('Pessoa 7')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: 'Voltar para o histórico' }),
    ).toHaveAttribute('href', '/aluno/historico');
  });

  it('o professor volta ao histórico dele', async () => {
    mockApi(reportRoutes([makeAdvisingReport(7)], 'teacher'));
    renderApp('/professor/historico/7/relatorio');

    expect(
      await screen.findByRole('link', { name: 'Voltar para o histórico' }),
    ).toHaveAttribute('href', '/professor/historico');
  });

  it('voltar restaura a busca e a página do histórico de onde o relatório foi aberto', async () => {
    mockApi(
      reportRoutes([makeAdvisingReport(1)], 'student', undefined, [
        makeEndedAdvising(1),
      ]),
    );
    const user = userEvent.setup();
    renderApp('/aluno/historico?busca=pessoa&pagina=1');

    await user.click(
      await screen.findByRole('link', { name: /Ver relatório/ }),
    );
    const back = await screen.findByRole('link', {
      name: 'Voltar para o histórico',
    });

    expect(back).toHaveAttribute(
      'href',
      '/aluno/historico?busca=pessoa&pagina=1',
    );
    await user.click(back);
    expect(await screen.findByLabelText('Buscar orientador')).toHaveValue(
      'pessoa',
    );
  });

  it('mesmo com o relatório em erro, a seta de voltar continua disponível', async () => {
    mockApi(
      reportRoutes([makeAdvisingReport(7)], 'student', {
        status: 500,
        body: { detail: 'Falha no servidor.' },
      }),
    );
    renderApp('/aluno/historico/7/relatorio');

    await screen.findByRole('alert');

    expect(
      screen.getByRole('link', { name: 'Voltar para o histórico' }),
    ).toBeVisible();
  });
});

describe('AdvisingReportPage: o menu e o celular', () => {
  it('mantém selecionado o item "Histórico de orientações" do menu', async () => {
    mockApi(reportRoutes([makeAdvisingReport(7)]));
    renderApp('/aluno/historico/7/relatorio');
    await screen.findByRole('heading', { level: 1, name: 'Pessoa 7' });

    const menu = screen.getByRole('navigation', { name: 'Menu principal' });

    expect(
      within(menu).getByRole('link', { name: 'Histórico de orientações' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('em tela estreita, o relatório continua legível e com os mesmos dados', async () => {
    setViewportWidth(PHONE_WIDTH);
    mockApi(reportRoutes([makeAdvisingReport(7)]));
    renderApp('/aluno/historico/7/relatorio');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pessoa 7' }),
    ).toBeVisible();
    expect(screen.getByText('Motivo do encerramento')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Registros' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Reuniões' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Atividades' })).toBeVisible();
  });
});
