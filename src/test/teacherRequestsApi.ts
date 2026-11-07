import type { MockResponse } from './mockApi';

export interface FakeRequest {
  id: number;
  status: string;
  requested_at: string;
  responded_at: string | null;
  expires_at: string | null;
  student: {
    id: number;
    full_name: string;
    course: { id: number; name: string };
    areas: { id: number; name: string }[];
  };
}

export function makeRequest(
  id: number,
  status = 'pending',
  overrides: Partial<FakeRequest> = {},
): FakeRequest {
  return {
    id,
    status,
    requested_at: '2026-11-02T14:30:00Z',
    responded_at:
      status === 'accepted' || status === 'rejected'
        ? '2026-11-03T12:00:00Z'
        : null,
    expires_at:
      status === 'pending' || status === 'unanswered'
        ? '2026-11-09T14:30:00Z'
        : null,
    student: {
      id: 100 + id,
      full_name: `Aluno ${id}`,
      course: { id: 10, name: 'Ciência da Computação' },
      areas: [{ id: 1, name: 'Banco de Dados' }],
    },
    ...overrides,
  };
}

type Answer = MockResponse | ((body: unknown) => MockResponse);

/**
 * Um servidor simulado com estado: filtra por situação, pagina como a API real, e uma resposta
 * muda a solicitação, então a leitura seguinte já a reflete.
 */
export function requestRoutes(
  items: FakeRequest[],
  answers: Record<number, Answer> = {},
): Record<string, MockResponse | ((body: unknown, url: URL) => MockResponse)> {
  const state = items.map((item) => ({ ...item }));
  const routes: Record<
    string,
    MockResponse | ((body: unknown, url: URL) => MockResponse)
  > = {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': {
      body: {
        id: 9,
        full_name: 'Carlos Lima',
        email: 'carlos@example.com',
        type: 'teacher',
        active_advisees_count: 0,
      },
    },
    'GET /api/orientacao/solicitacoes': (_body, url) => {
      const status = url.searchParams.get('status');
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const matching = state.filter(
        (item) => !status || item.status === status,
      );
      return {
        body: {
          items: matching.slice(offset, offset + limit),
          count: matching.length,
        },
      };
    },
  };
  for (const item of state) {
    routes[`POST /api/orientacao/solicitacoes/${item.id}/responder`] = (
      body,
    ) => {
      const custom = answers[item.id];
      if (custom) return typeof custom === 'function' ? custom(body) : custom;
      const accepted = (body as { action: string }).action === 'accept';
      item.status = accepted ? 'accepted' : 'rejected';
      item.responded_at = '2026-11-04T10:00:00Z';
      item.expires_at = null;
      return {
        body: {
          ...item,
          advising: accepted
            ? { id: 50 + item.id, started_at: '2026-11-04T10:00:00Z' }
            : null,
        },
      };
    };
  }
  return routes;
}
