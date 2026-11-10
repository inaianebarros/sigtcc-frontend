import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import {
  STUDENT_ME,
  makeDashboardWithoutAdvising,
  makeStudentDashboard,
  makeStudentMeeting,
  studentDashboardRoutes,
} from '../test/dashboardApi';
import type { FakeStudentDashboard } from '../test/dashboardApi';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

function setup(dashboard: FakeStudentDashboard) {
  mockApi(studentDashboardRoutes(() => dashboard, STUDENT_ME));
  const events = userEvent.setup({ applyAccept: false });
  renderApp('/aluno/dashboard');
  return { events };
}

const block = () => screen.findByRole('region', { name: 'Próximas reuniões' });

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Dashboard do aluno: próximas reuniões', () => {
  it('lista as reuniões aceitas na ordem da API, com data, horário, professor e descrição', async () => {
    setup(
      makeStudentDashboard({
        next_meetings: {
          items: [
            makeStudentMeeting(1, {
              scheduled_at: '2099-12-10T14:30:00-03:00',
              description: 'Revisar o capítulo 2',
            }),
            makeStudentMeeting(2, {
              scheduled_at: '2099-12-20T09:00:00-03:00',
              teacher: { id: 9, full_name: 'Carlos Lima' },
              description: 'Definir a banca',
            }),
          ],
          has_more: false,
        },
      }),
    );

    const region = await block();

    const [first, second] = within(region).getAllByRole('listitem');
    expect(
      within(first!).getByText('10 de dezembro de 2099, às 14:30'),
    ).toBeVisible();
    expect(within(first!).getByText('Professor: Carlos Lima')).toBeVisible();
    expect(within(first!).getByText('Revisar o capítulo 2')).toBeVisible();
    expect(
      within(second!).getByText('20 de dezembro de 2099, às 09:00'),
    ).toBeVisible();
    expect(within(second!).getByText('Definir a banca')).toBeVisible();
  });

  it('sem reuniões mostra o estado vazio informativo e o link para a tela de reuniões', async () => {
    setup(makeStudentDashboard());

    const region = await block();

    expect(
      within(region).getByText('Você não possui reuniões agendadas.'),
    ).toBeVisible();
    expect(
      within(region).getByRole('link', { name: 'Ir para as reuniões' }),
    ).toHaveAttribute('href', '/aluno/reunioes');
    expect(within(region).queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('o link leva à tela de reuniões', async () => {
    const { events } = setup(makeStudentDashboard());
    const region = await block();

    await events.click(
      within(region).getByRole('link', { name: 'Ir para as reuniões' }),
    );

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/aluno/reunioes',
    );
  });

  it('oferece "Ver todas" só quando há mais reuniões que o limite', async () => {
    setup(
      makeStudentDashboard({
        next_meetings: { items: [makeStudentMeeting(1)], has_more: true },
      }),
    );

    const region = await block();

    expect(
      within(region).getByRole('link', { name: 'Ver todas' }),
    ).toHaveAttribute('href', '/aluno/reunioes');
  });

  it('sem "mais" não oferece "Ver todas"', async () => {
    setup(
      makeStudentDashboard({
        next_meetings: { items: [makeStudentMeeting(1)], has_more: false },
      }),
    );

    const region = await block();

    expect(
      within(region).queryByRole('link', { name: 'Ver todas' }),
    ).not.toBeInTheDocument();
  });

  it('o bloco aparece mesmo sem atividades, porque as reuniões não dependem delas', async () => {
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
        next_meetings: { items: [makeStudentMeeting(1)], has_more: false },
      }),
    );

    const region = await block();

    expect(within(region).getByText('Reunião 1')).toBeVisible();
  });

  it('sem orientação ativa o bloco não aparece', async () => {
    setup(makeDashboardWithoutAdvising());

    await screen.findByRole('region', { name: 'Sem orientação ativa' });

    expect(
      screen.queryByRole('region', { name: 'Próximas reuniões' }),
    ).not.toBeInTheDocument();
  });

  it('uma resposta sem o bloco não quebra a tela', async () => {
    const dashboard = makeStudentDashboard();
    setup({ ...dashboard, next_meetings: null });

    await screen.findByRole('region', { name: 'Orientação' });

    expect(
      screen.queryByRole('region', { name: 'Próximas reuniões' }),
    ).not.toBeInTheDocument();
  });
});
