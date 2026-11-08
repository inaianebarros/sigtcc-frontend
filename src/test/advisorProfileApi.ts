import type { MockResponse } from './mockApi';

export interface FakeAdvisorProfile {
  id: number;
  full_name: string;
  institute: { id: number; name: string };
  courses: { id: number; name: string }[];
  areas: { id: number; name: string; is_common: boolean }[];
  compatibility: number;
  is_available: boolean;
  articles: { title: string; year: number; url: string }[];
}

export function makeAdvisorProfile(
  id: number,
  overrides: Partial<FakeAdvisorProfile> = {},
): FakeAdvisorProfile {
  return {
    id,
    full_name: `Professor ${id}`,
    institute: { id: 1, name: 'Instituto de Engenharia e Geociências' },
    courses: [{ id: 10, name: 'Ciência da Computação' }],
    areas: [
      { id: 1, name: 'Banco de Dados', is_common: true },
      { id: 2, name: 'Redes de Computadores', is_common: false },
    ],
    compatibility: 1,
    is_available: true,
    articles: [],
    ...overrides,
  };
}

/** As rotas do perfil de cada professor; qualquer outro id cai no 404 do servidor simulado. */
export function advisorProfileRoutes(
  profiles: FakeAdvisorProfile[],
): Record<string, MockResponse> {
  return Object.fromEntries(
    profiles.map((profile) => [
      `GET /api/professores/${profile.id}/perfil`,
      { body: profile },
    ]),
  );
}
