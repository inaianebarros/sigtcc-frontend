import type { MockResponse } from './mockApi';

export interface FakeDashboardActivity {
  id: number;
  title: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'in_review' | 'completed';
  overdue: boolean;
}

export interface FakeStudentDashboard {
  has_active_advising: boolean;
  advising: {
    teacher: { id: number; full_name: string };
    thesis_topic: string | null;
  } | null;
  activities: {
    total: number;
    pending: number;
    in_progress: number;
    in_review: number;
    completed: number;
    overdue: number;
    progress_percent: number | null;
  } | null;
  next_activities: { items: FakeDashboardActivity[]; has_more: boolean } | null;
  last_request: {
    id: number;
    status: 'pending' | 'rejected' | 'unanswered';
    requested_at: string;
    teacher: { id: number; full_name: string };
  } | null;
  has_ended_advisings: boolean;
}

export function makeDashboardActivity(
  id: number,
  overrides: Partial<FakeDashboardActivity> = {},
): FakeDashboardActivity {
  return {
    id,
    title: `Atividade ${id}`,
    deadline: '2099-12-31',
    status: 'pending',
    overdue: false,
    ...overrides,
  };
}

/** Uma Dashboard de aluno com orientação ativa: 5 atividades, 1 concluída (20%) e 1 atrasada. */
export function makeStudentDashboard(
  overrides: Partial<FakeStudentDashboard> = {},
): FakeStudentDashboard {
  return {
    has_active_advising: true,
    advising: {
      teacher: { id: 9, full_name: 'Carlos Lima' },
      thesis_topic: 'Redes neurais em saúde',
    },
    activities: {
      total: 5,
      pending: 2,
      in_progress: 1,
      in_review: 1,
      completed: 1,
      overdue: 1,
      progress_percent: 20,
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
      ],
      has_more: false,
    },
    last_request: null,
    has_ended_advisings: false,
    ...overrides,
  };
}

/** Um aluno sem orientação ativa: só a situação, a última solicitação e o histórico. */
export function makeDashboardWithoutAdvising(
  overrides: Partial<FakeStudentDashboard> = {},
): FakeStudentDashboard {
  return makeStudentDashboard({
    has_active_advising: false,
    advising: null,
    activities: null,
    next_activities: null,
    ...overrides,
  });
}

type Handler = (
  body: unknown,
  url: URL,
  params: Record<string, string>,
) => MockResponse | Promise<MockResponse>;

export const STUDENT_ME = {
  id: 7,
  full_name: 'Ana Souza',
  email: 'ana@example.com',
  type: 'student',
  has_active_advising: true,
} as const;

export function studentDashboardRoutes(
  dashboard: () => FakeStudentDashboard,
  me: Record<string, unknown> = STUDENT_ME,
  overrides: Record<string, MockResponse | Handler> = {},
): Record<string, MockResponse | Handler> {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': { body: me },
    'GET /api/painel/aluno': () => ({ body: dashboard() }),
    ...overrides,
  };
}

export interface FakeAttentionAdvisee {
  id: number;
  full_name: string;
  thesis_topic: string | null;
  overdue_count: number;
  in_review_count: number;
}

export interface FakeDeadline extends FakeDashboardActivity {
  student: { id: number; full_name: string };
}

export interface FakeTeacherDashboard {
  advisees_count: number;
  activities: NonNullable<FakeStudentDashboard['activities']> | null;
  attention_advisees: {
    items: FakeAttentionAdvisee[];
    has_more: boolean;
  } | null;
  next_deadlines: { items: FakeDeadline[]; has_more: boolean } | null;
}

export function makeAttentionAdvisee(
  id: number,
  overrides: Partial<FakeAttentionAdvisee> = {},
): FakeAttentionAdvisee {
  return {
    id,
    full_name: `Orientando ${id}`,
    thesis_topic: `Tema ${id}`,
    overdue_count: 1,
    in_review_count: 0,
    ...overrides,
  };
}

export function makeDeadline(
  id: number,
  overrides: Partial<FakeDeadline> = {},
): FakeDeadline {
  return {
    ...makeDashboardActivity(id),
    student: { id: 101, full_name: 'Maria Lima' },
    ...overrides,
  };
}

/** Uma Dashboard de professor com 2 orientandos e 10 atividades, 3 concluídas (30%). */
export function makeTeacherDashboard(
  overrides: Partial<FakeTeacherDashboard> = {},
): FakeTeacherDashboard {
  return {
    advisees_count: 2,
    activities: {
      total: 10,
      pending: 3,
      in_progress: 2,
      in_review: 2,
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
          in_review_count: 1,
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
    next_deadlines: {
      items: [
        makeDeadline(21, {
          title: 'Capítulo 1',
          deadline: '2026-11-01',
          status: 'in_progress',
          overdue: true,
        }),
        makeDeadline(22, {
          title: 'Capítulo 2',
          deadline: '2026-12-15',
          student: { id: 102, full_name: 'João Souza' },
        }),
      ],
      has_more: false,
    },
    ...overrides,
  };
}

/** Um professor sem orientações ativas: a resposta vazia da API. */
export function makeEmptyTeacherDashboard(): FakeTeacherDashboard {
  return {
    advisees_count: 0,
    activities: null,
    attention_advisees: null,
    next_deadlines: null,
  };
}

export const TEACHER_ME = {
  id: 9,
  full_name: 'Carlos Lima',
  email: 'carlos@example.com',
  type: 'teacher',
  active_advisees_count: 2,
} as const;

export function teacherDashboardRoutes(
  dashboard: () => FakeTeacherDashboard,
  me: Record<string, unknown> = TEACHER_ME,
  overrides: Record<string, MockResponse | Handler> = {},
): Record<string, MockResponse | Handler> {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': { body: me },
    'GET /api/painel/professor': () => ({ body: dashboard() }),
    ...overrides,
  };
}
