import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import {
  TEACHER_ME,
  makeEmptyTeacherDashboard,
  makeTeacherDashboard,
  makeTeacherMeeting,
  teacherDashboardRoutes,
} from '../test/dashboardApi';
import type { FakeTeacherDashboard } from '../test/dashboardApi';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

function setup(dashboard: FakeTeacherDashboard) {
  mockApi(teacherDashboardRoutes(() => dashboard, TEACHER_ME));
  const events = userEvent.setup({ applyAccept: false });
  renderApp('/professor/dashboard');
  return { events };
}

const block = () => screen.findByRole('region', { name: 'Próximas reuniões' });

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Dashboard do professor: próximas reuniões', () => {
  it('lista as reuniões aceitas na ordem da API, com o orientando, a data, o horário e a descrição', async () => {
    setup(
      makeTeacherDashboard({
        next_meetings: {
          items: [
            makeTeacherMeeting(1, {
              scheduled_at: '2099-12-10T14:30:00-03:00',
              student: { id: 101, full_name: 'Maria Lima' },
              description: 'Revisar o capítulo 2',
            }),
            makeTeacherMeeting(2, {
              scheduled_at: '2099-12-20T09:00:00-03:00',
              student: { id: 102, full_name: 'João Souza' },
              description: 'Definir a banca',
            }),
          ],
          has_more: false,
        },
      }),
    );

    const region = await block();

    const [first, second] = within(region).getAllByRole('listitem');
    expect(within(first!).getByText('Orientando: Maria Lima')).toBeVisible();
    expect(
      within(first!).getByText('10 de dezembro de 2099, das 14:30 às 15:30'),
    ).toBeVisible();
    expect(within(first!).getByText('Revisar o capítulo 2')).toBeVisible();
    expect(within(second!).getByText('Orientando: João Souza')).toBeVisible();
    expect(
      within(second!).getByText('20 de dezembro de 2099, das 09:00 às 10:00'),
    ).toBeVisible();
  });

  it('sem reuniões mostra o estado vazio informativo e o link para a tela de reuniões', async () => {
    setup(makeTeacherDashboard());

    const region = await block();

    expect(
      within(region).getByText('Você não possui reuniões agendadas.'),
    ).toBeVisible();
    expect(
      within(region).getByRole('link', { name: 'Ir para as reuniões' }),
    ).toHaveAttribute('href', '/professor/reunioes');
  });

  it('o link leva à tela de reuniões do professor', async () => {
    const { events } = setup(makeTeacherDashboard());
    const region = await block();

    await events.click(
      within(region).getByRole('link', { name: 'Ir para as reuniões' }),
    );

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/professor/reunioes',
    );
  });

  it('oferece "Ver todas" só quando há mais reuniões que o limite', async () => {
    setup(
      makeTeacherDashboard({
        next_meetings: { items: [makeTeacherMeeting(1)], has_more: true },
      }),
    );

    const region = await block();

    expect(
      within(region).getByRole('link', { name: 'Ver todas' }),
    ).toHaveAttribute('href', '/professor/reunioes');
  });

  it('sem "mais" não oferece "Ver todas"', async () => {
    setup(
      makeTeacherDashboard({
        next_meetings: { items: [makeTeacherMeeting(1)], has_more: false },
      }),
    );

    const region = await block();

    expect(
      within(region).queryByRole('link', { name: 'Ver todas' }),
    ).not.toBeInTheDocument();
  });

  it('o bloco aparece mesmo com orientandos sem atividades', async () => {
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
        next_meetings: { items: [makeTeacherMeeting(1)], has_more: false },
      }),
    );

    const region = await block();

    expect(within(region).getByText('Reunião 1')).toBeVisible();
  });

  it('sem orientandos ativos o bloco não aparece', async () => {
    setup(makeEmptyTeacherDashboard());

    await screen.findByText(/Você ainda não tem orientandos ativos/);

    expect(
      screen.queryByRole('region', { name: 'Próximas reuniões' }),
    ).not.toBeInTheDocument();
  });

  it('uma resposta sem o bloco não quebra a tela', async () => {
    setup({ ...makeTeacherDashboard(), next_meetings: null });

    await screen.findByRole('region', { name: 'Indicadores das orientações' });

    expect(
      screen.queryByRole('region', { name: 'Próximas reuniões' }),
    ).not.toBeInTheDocument();
  });
});
