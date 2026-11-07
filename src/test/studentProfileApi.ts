import type { MockResponse } from './mockApi';

export const STUDENT_PROFILE = {
  full_name: 'Ana Souza',
  email: 'ana@example.com',
  registration_number: '202100123',
  institute_id: 1,
  course_id: 10,
  area_ids: [1, 3],
  articles: [
    {
      title: 'Gestão de TCC com Django',
      year: 2024,
      url: 'https://example.com/a',
    },
    { title: 'Orientação por áreas', year: 2023, url: '' },
  ],
};

export const AREAS = [
  { id: 1, name: 'Inteligência Artificial' },
  { id: 2, name: 'Banco de Dados' },
  { id: 3, name: 'Engenharia de Software' },
];

export function studentProfileRoutes(
  profile: Record<string, unknown> = STUDENT_PROFILE,
): Record<string, MockResponse> {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': {
      body: {
        id: 7,
        full_name: String(profile.full_name),
        email: 'ana@example.com',
        type: 'student',
        has_active_advising: false,
      },
    },
    'GET /api/alunos/me/perfil': { body: profile },
    'GET /api/areas-de-interesse': { body: AREAS },
    'GET /api/institutos': {
      body: [{ id: 1, name: 'Instituto de Engenharia e Geociências' }],
    },
    'GET /api/cursos': {
      body: [{ id: 10, institute_id: 1, name: 'Ciência da Computação' }],
    },
  };
}
