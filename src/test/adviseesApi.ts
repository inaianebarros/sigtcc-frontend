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

/**
 * Um servidor simulado com estado: pagina como a API real, mantém a ordem recebida e, ao encerrar
 * uma orientação, tira o orientando da lista e da contagem que o menu lê em /auth/me.
 */
export function adviseeRoutes(
  items: FakeAdvisee[],
  ends: Record<number, Handler> = {},
): Record<string, Handler> {
  const state = [...items];
  const routes: Record<string, Handler> = {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': () => ({
      body: {
        id: 9,
        full_name: 'Carlos Lima',
        email: 'carlos@example.com',
        type: 'teacher',
        active_advisees_count: state.length,
      },
    }),
    'GET /api/orientacao/orientandos': (_body, url) => {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return {
        body: {
          items: state.slice(offset, offset + limit),
          count: state.length,
        },
      };
    },
  };
  for (const item of items) {
    routes[`POST /api/orientacao/${item.advising_id}/encerrar`] = (
      body,
      url,
    ) => {
      const custom = ends[item.advising_id];
      if (custom)
        return typeof custom === 'function' ? custom(body, url) : custom;
      const index = state.findIndex(
        (candidate) => candidate.advising_id === item.advising_id,
      );
      if (index >= 0) state.splice(index, 1);
      return {
        body: {
          id: item.advising_id,
          status: 'ended',
          started_at: item.started_at,
          ended_at: '2026-11-08T10:00:00Z',
          reason: (body as { reason: string }).reason,
        },
      };
    };
  }
  return routes;
}
