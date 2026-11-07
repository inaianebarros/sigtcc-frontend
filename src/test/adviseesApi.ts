import type { MockResponse } from './mockApi';

export interface FakeAdvisee {
  advising_id: number;
  student: {
    id: number;
    full_name: string;
    course: { id: number; name: string };
  };
  started_at: string;
  thesis_topic: string | null;
  activities: {
    pending: number;
    in_progress: number;
    in_review: number;
    completed: number;
  };
}

export function makeAdvisee(
  id: number,
  overrides: Partial<FakeAdvisee> = {},
): FakeAdvisee {
  return {
    advising_id: id,
    student: {
      id: 100 + id,
      full_name: `Orientando ${id}`,
      course: { id: 10, name: 'Ciência da Computação' },
    },
    started_at: '2026-11-02T14:30:00Z',
    thesis_topic: `Tema do orientando ${id}`,
    activities: { pending: 1, in_progress: 2, in_review: 3, completed: 4 },
    ...overrides,
  };
}

type Handler = MockResponse | ((body: unknown, url: URL) => MockResponse);

/** Um servidor simulado que pagina como a API real e mantém a ordem recebida. */
export function adviseeRoutes(
  items: FakeAdvisee[],
  teacher: { active_advisees_count: number } = {
    active_advisees_count: items.length,
  },
): Record<string, Handler> {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': {
      body: {
        id: 9,
        full_name: 'Carlos Lima',
        email: 'carlos@example.com',
        type: 'teacher',
        ...teacher,
      },
    },
    'GET /api/orientacao/orientandos': (_body, url) => {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return {
        body: {
          items: items.slice(offset, offset + limit),
          count: items.length,
        },
      };
    },
  };
}
