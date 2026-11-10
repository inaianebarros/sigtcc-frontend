import type { MockResponse } from './mockApi';

export interface FakeEndedAdvising {
  id: number;
  counterpart: { id: number; full_name: string };
  started_at: string;
  ended_at: string;
  reason: string;
  thesis_topic: string | null;
}

export function makeEndedAdvising(
  id: number,
  overrides: Partial<FakeEndedAdvising> = {},
): FakeEndedAdvising {
  return {
    id,
    counterpart: { id: 100 + id, full_name: `Pessoa ${id}` },
    started_at: '2026-08-03T14:30:00Z',
    ended_at: '2026-11-02T14:30:00Z',
    reason: `Concluímos o ciclo da orientação ${id}.`,
    thesis_topic: `Tema da orientação ${id}`,
    ...overrides,
  };
}

type Handler = MockResponse | ((body: unknown, url: URL) => MockResponse);

/** Um servidor simulado do perfil dado: pagina como a API real e mantém a ordem recebida. */
export function historyRoutes(
  items: FakeEndedAdvising[],
  user: 'student' | 'teacher' = 'student',
  list?: Handler,
): Record<string, Handler> {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': () => ({
      body:
        user === 'student'
          ? {
              id: 7,
              full_name: 'Ana Souza',
              email: 'ana@example.com',
              type: 'student',
              has_active_advising: false,
            }
          : {
              id: 9,
              full_name: 'Carlos Lima',
              email: 'carlos@example.com',
              type: 'teacher',
              active_advisees_count: 0,
            },
    }),
    'GET /api/orientacao/historico':
      list ??
      ((_body, url) => {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return {
          body: {
            items: items.slice(offset, offset + limit),
            count: items.length,
          },
        };
      }),
  };
}
