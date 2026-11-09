import type { MockResponse } from './mockApi';

export interface FakeComment {
  id: number;
  text: string;
  created_at: string;
  author: { id: number; full_name: string; type: 'student' | 'teacher' };
}

type Handler = (
  body: unknown,
  url: URL,
  params: Record<string, string>,
) => MockResponse | Promise<MockResponse>;

export const STUDENT_AUTHOR = {
  id: 7,
  full_name: 'Ana Souza',
  type: 'student',
} as const;
export const TEACHER_AUTHOR = {
  id: 9,
  full_name: 'Carlos Lima',
  type: 'teacher',
} as const;

export function makeComment(
  id: number,
  overrides: Partial<FakeComment> = {},
): FakeComment {
  return {
    id,
    text: `Comentário ${id}`,
    created_at: '2026-11-02T14:30:00Z',
    author: STUDENT_AUTHOR,
    ...overrides,
  };
}

export interface CommentsServer {
  routes: Record<string, MockResponse | Handler>;
  /** O estado atual do servidor simulado. */
  comments: () => FakeComment[];
  /** Um comentário que chega de fora, como o da outra parte, sem passar pela tela. */
  receive: (comment: FakeComment) => void;
}

/**
 * Os comentários de uma atividade, simulados com estado como a API real: paginados por `limit` e
 * `offset`, do mais antigo para o mais novo, com o total em `count`.
 */
export function commentsServer(
  initial: FakeComment[],
  author: FakeComment['author'],
  overrides: Record<string, MockResponse | Handler> = {},
): CommentsServer {
  const state = initial.map((item) => structuredClone(item));
  let nextId = Math.max(0, ...initial.map((item) => item.id)) + 1;
  const routes: Record<string, MockResponse | Handler> = {
    'GET /api/atividades/:id/comentarios': (_body, url) => {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return {
        body: {
          items: state.slice(offset, offset + limit),
          count: state.length,
        },
      };
    },
    'POST /api/atividades/:id/comentarios': (body) => {
      const { text } = body as { text: string };
      const created = makeComment(nextId++, {
        text,
        created_at: '2026-11-09T15:00:00Z',
        author,
      });
      state.push(created);
      return { status: 201, body: created };
    },
    ...overrides,
  };
  return {
    routes,
    comments: () => state,
    receive: (comment) => {
      state.push(comment);
    },
  };
}
