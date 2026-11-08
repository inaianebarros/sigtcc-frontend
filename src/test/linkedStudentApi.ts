import type { MockResponse } from './mockApi';

export interface FakeLinkedStudent {
  id: number;
  full_name: string;
  institute: { id: number; name: string };
  course: { id: number; name: string };
  areas: { id: number; name: string; is_common: boolean }[];
  compatibility: number;
  articles: { title: string; year: number; url: string }[];
}

export function makeLinkedStudent(
  id: number,
  overrides: Partial<FakeLinkedStudent> = {},
): FakeLinkedStudent {
  return {
    id,
    full_name: `Aluno ${id}`,
    institute: { id: 1, name: 'Instituto de Engenharia e Geociências' },
    course: { id: 10, name: 'Ciência da Computação' },
    areas: [
      { id: 1, name: 'Banco de Dados', is_common: true },
      { id: 2, name: 'Inteligência Artificial', is_common: false },
    ],
    compatibility: 1,
    articles: [],
    ...overrides,
  };
}

/** As rotas do perfil de cada aluno vinculado; qualquer outro id cai no 404 do servidor simulado. */
export function linkedStudentRoutes(
  students: FakeLinkedStudent[],
): Record<string, MockResponse> {
  return Object.fromEntries(
    students.map((student) => [
      `GET /api/alunos/${student.id}/perfil`,
      { body: student },
    ]),
  );
}
