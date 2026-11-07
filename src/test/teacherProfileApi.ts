import { AREAS } from './studentProfileApi';
import type { MockResponse } from './mockApi';

export const TEACHER_PROFILE = {
  full_name: 'Carlos Lima',
  email: 'carlos@example.com',
  registration_number: 'P0001',
  institute_id: 1,
  course_ids: [10],
  area_ids: [1, 3],
  is_available: true,
  articles: [
    { title: 'Orientação por áreas', year: 2023, url: 'https://example.com/o' },
  ],
};

export const INSTITUTE_COURSES = [
  { id: 10, institute_id: 1, name: 'Ciência da Computação' },
  { id: 11, institute_id: 1, name: 'Engenharia da Computação' },
  { id: 12, institute_id: 1, name: 'Sistemas de Informação' },
];

export function teacherProfileRoutes(
  profile: Record<string, unknown> = TEACHER_PROFILE,
): Record<string, MockResponse> {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': {
      body: {
        id: 9,
        full_name: String(profile.full_name),
        email: 'carlos@example.com',
        type: 'teacher',
        active_advisees_count: 0,
      },
    },
    'GET /api/professores/me/perfil': { body: profile },
    'GET /api/areas-de-interesse': { body: AREAS },
    'GET /api/institutos': {
      body: [{ id: 1, name: 'Instituto de Engenharia e Geociências' }],
    },
    'GET /api/cursos': { body: INSTITUTE_COURSES },
  };
}
