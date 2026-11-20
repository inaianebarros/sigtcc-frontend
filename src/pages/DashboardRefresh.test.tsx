import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFRESH_INTERVAL_MS } from '../hooks/useRefreshedLoad';
import { tokenStore } from '../services/tokenStore';
import {
  STUDENT_ME,
  TEACHER_ME,
  makeAttentionAdvisee,
  makeDashboardActivity,
  makeDashboardWithoutAdvising,
  makeEmptyTeacherDashboard,
  makeStudentDashboard,
  makeTeacherDashboard,
  studentDashboardRoutes,
  teacherDashboardRoutes,
} from '../test/dashboardApi';
import type {
  FakeStudentDashboard,
  FakeTeacherDashboard,
} from '../test/dashboardApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const STUDENT_DASHBOARD = 'GET /api/painel/aluno';
const TEACHER_DASHBOARD = 'GET /api/painel/professor';

/** Um ciclo de releitura: 30 s com a aba visível. */
async function nextCycle() {
  // O ciclo é registrado num efeito: o `act` o descarrega antes de o relógio andar.
  await act(async () => {});
  await act(async () => {
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
  });
}

function setupStudent(initial: FakeStudentDashboard) {
  let current = initial;
  const fetchMock = mockApi(studentDashboardRoutes(() => current, STUDENT_ME));
  renderApp('/aluno/dashboard');
  return {
    fetchMock,
    serve: (next: FakeStudentDashboard) => {
      current = next;
    },
  };
}

function setupTeacher(initial: FakeTeacherDashboard) {
  let current = initial;
  const fetchMock = mockApi(teacherDashboardRoutes(() => current, TEACHER_ME));
  renderApp('/professor/dashboard');
  return {
    fetchMock,
    serve: (next: FakeTeacherDashboard) => {
      current = next;
    },
  };
}

const indicator = (region: HTMLElement, label: string) =>
  within(region).getByRole('group', { name: label });

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Início do aluno: relido a cada 30 s', () => {
  it('mostra a orientação criada quando o professor aceita a solicitação, sem esqueleto', async () => {
    const { fetchMock, serve } = setupStudent(
      makeDashboardWithoutAdvising({
        last_request: {
          id: 1,
          status: 'pending',
          requested_at: '2026-11-05T12:00:00Z',
          teacher: { id: 9, full_name: 'Carlos Lima' },
        },
      }),
    );
    await screen.findByText(
      /Sua solicitação para Carlos Lima aguarda resposta/,
    );
    const reads = requestsTo(fetchMock, STUDENT_DASHBOARD).length;

    serve(makeStudentDashboard());
    await nextCycle();

    const advising = await screen.findByRole('region', { name: 'Orientação' });
    expect(within(advising).getByText(/Carlos Lima/)).toBeVisible();
    expect(
      screen.queryByText(/Sua solicitação para Carlos Lima aguarda resposta/),
    ).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, STUDENT_DASHBOARD)).toHaveLength(reads + 1);
    expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
  });

  it('mostra a atividade criada e os números novos, mantendo o foco no link focado', async () => {
    const { serve } = setupStudent(makeStudentDashboard());
    const list = await screen.findByRole('region', {
      name: 'Próximas atividades',
    });
    const link = within(list).getByRole('link', { name: /Capítulo 2/ });
    act(() => link.focus());

    serve(
      makeStudentDashboard({
        activities: {
          total: 6,
          pending: 3,
          in_progress: 1,
          in_review: 1,
          completed: 1,
          overdue: 1,
          progress_percent: 16,
        },
        next_activities: {
          items: [
            makeDashboardActivity(11, {
              title: 'Capítulo 1',
              deadline: '2026-11-01',
              status: 'in_progress',
              overdue: true,
            }),
            makeDashboardActivity(12, {
              title: 'Capítulo 2',
              deadline: '2026-12-15',
              status: 'pending',
            }),
            makeDashboardActivity(13, {
              title: 'Capítulo 3',
              deadline: '2026-12-20',
              status: 'pending',
            }),
          ],
          has_more: false,
        },
      }),
    );
    await nextCycle();

    expect(
      await within(list).findByRole('link', { name: /Capítulo 3/ }),
    ).toBeVisible();
    expect(screen.getByText('16%')).toBeVisible();
    expect(link).toHaveFocus();
  });
});

describe('Início do professor: relido a cada 30 s', () => {
  it('mostra o primeiro orientando quando o professor aceita uma solicitação em outra aba', async () => {
    const { serve } = setupTeacher(makeEmptyTeacherDashboard());
    await screen.findByText(/Você ainda não tem orientandos ativos/);

    serve(makeTeacherDashboard());
    await nextCycle();

    const region = await screen.findByRole('region', {
      name: 'Indicadores das orientações',
    });
    expect(
      within(indicator(region, 'Orientandos ativos')).getByText('2'),
    ).toBeVisible();
    expect(
      screen.queryByText(/Você ainda não tem orientandos ativos/),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
  });

  it('mostra a entrega enviada para revisão pelo aluno na lista de atenção e nos números', async () => {
    const { fetchMock, serve } = setupTeacher(makeTeacherDashboard());
    const region = await screen.findByRole('region', {
      name: 'Indicadores das orientações',
    });
    expect(
      within(indicator(region, 'Aguardando revisão')).getByText('2'),
    ).toBeVisible();
    const reads = requestsTo(fetchMock, TEACHER_DASHBOARD).length;

    serve(
      makeTeacherDashboard({
        activities: {
          total: 10,
          pending: 2,
          in_progress: 2,
          in_review: 3,
          completed: 3,
          overdue: 2,
          progress_percent: 30,
        },
        attention_advisees: {
          items: [
            makeAttentionAdvisee(101, {
              full_name: 'Maria Lima',
              thesis_topic: 'Redes neurais em saúde',
              overdue_count: 2,
              in_review_count: 2,
            }),
            makeAttentionAdvisee(102, {
              full_name: 'João Souza',
              thesis_topic: null,
              overdue_count: 0,
              in_review_count: 1,
            }),
          ],
          has_more: false,
        },
      }),
    );
    await nextCycle();

    expect(
      await within(indicator(region, 'Aguardando revisão')).findByText('3'),
    ).toBeVisible();
    expect(requestsTo(fetchMock, TEACHER_DASHBOARD)).toHaveLength(reads + 1);
    expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
  });
});
