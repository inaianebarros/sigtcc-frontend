import type { MockResponse } from './mockApi';

export interface FakeAdvisor {
  id: number;
  full_name: string;
  institute: { id: number; name: string };
  compatibility: number;
  common_areas: { id: number; name: string }[];
  is_available: boolean;
}

const INSTITUTE = { id: 1, name: 'Instituto de Engenharia e Geociências' };

export function makeAdvisor(
  id: number,
  overrides: Partial<FakeAdvisor> = {},
): FakeAdvisor {
  return {
    id,
    full_name: `Professor ${id}`,
    institute: INSTITUTE,
    compatibility: 0,
    common_areas: [],
    is_available: true,
    ...overrides,
  };
}

export const ELIGIBLE = {
  request: null,
  advising: null,
  can_request: true,
  blocked_reason: null,
};

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Um servidor simulado: filtra por nome (sem acentos) e pagina como a API real. */
export function searchResponse(advisors: FakeAdvisor[], url: URL) {
  const name = plain(url.searchParams.get('name') ?? '');
  const limit = Number(url.searchParams.get('limit') ?? 20);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const matching = advisors.filter((advisor) =>
    plain(advisor.full_name).includes(name),
  );
  return {
    body: {
      items: matching.slice(offset, offset + limit),
      count: matching.length,
    },
  };
}

export function advisorRoutes(
  advisors: FakeAdvisor[],
  status: Record<string, unknown> = ELIGIBLE,
): Record<string, MockResponse | ((body: unknown, url: URL) => MockResponse)> {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': {
      body: {
        id: 7,
        full_name: 'Ana Souza',
        email: 'ana@example.com',
        type: 'student',
        has_active_advising: false,
      },
    },
    'GET /api/orientadores/busca': (_body, url) =>
      searchResponse(advisors, url),
    'GET /api/orientacao/minha-solicitacao': { body: status },
  };
}
