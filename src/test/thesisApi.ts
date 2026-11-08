import { makeAdvisee } from './adviseesApi';
import type { FakeAdvisee } from './adviseesApi';
import type { MockResponse } from './mockApi';

export interface FakeTopic {
  description: string;
  updated_at: string;
}

export const SAVED_AT = '2026-11-09T12:00:00Z';

type Handler = (
  body: unknown,
  url: URL,
  params: Record<string, string>,
) => MockResponse | Promise<MockResponse>;

interface ServerOptions {
  user: 'student' | 'teacher';
  /** O tema do aluno logado (só o aluno). */
  topic?: FakeTopic | null;
  /** Os orientandos do professor, com o tema de cada um em `thesis_topic`. */
  advisees?: FakeAdvisee[];
  /** Substitui uma rota inteira, como uma falha ou um 409. */
  overrides?: Record<string, MockResponse | Handler>;
}

export interface ThesisServer {
  routes: Record<string, MockResponse | Handler>;
  /** A situação da orientação que o servidor informa em /auth/me: o teste a muda para encerrar. */
  endAdvising: () => void;
  topicOf: (studentId?: number) => FakeTopic | null;
}

const STUDENT_ID = 7;

/**
 * Um servidor de tema simulado com estado: grava o tema como a API real (201 ao criar e 200 ao
 * alterar), reflete o tema novo na lista de orientandos e informa a orientação em /auth/me.
 */
export function thesisServer({
  user,
  topic = null,
  advisees = [],
  overrides = {},
}: ServerOptions): ThesisServer {
  let advising = true;
  let own: FakeTopic | null = topic;
  const topics = new Map<number, FakeTopic | null>(
    advisees.map((advisee) => [
      advisee.student.id,
      advisee.thesis_topic
        ? { description: advisee.thesis_topic, updated_at: SAVED_AT }
        : null,
    ]),
  );
  const nulls = { description: null, updated_at: null };
  const routes: Record<string, MockResponse | Handler> = {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': () => ({
      body:
        user === 'student'
          ? {
              id: STUDENT_ID,
              full_name: 'Ana Souza',
              email: 'ana@example.com',
              type: 'student',
              has_active_advising: advising,
            }
          : {
              id: 9,
              full_name: 'Carlos Lima',
              email: 'carlos@example.com',
              type: 'teacher',
              active_advisees_count: advising ? advisees.length : 0,
            },
    }),
    'GET /api/tcc/tema': () => ({ body: own ?? nulls }),
    'PUT /api/tcc/tema': (body) => {
      const created = own === null;
      own = {
        description: (body as { description: string }).description,
        updated_at: SAVED_AT,
      };
      return { status: created ? 201 : 200, body: own };
    },
    'GET /api/tcc/orientandos/:id/tema': (_body, _url, params) => ({
      body: topics.get(Number(params.id)) ?? nulls,
    }),
    'PUT /api/tcc/orientandos/:id/tema': (body, _url, params) => {
      const id = Number(params.id);
      const created = !topics.get(id);
      const saved = {
        description: (body as { description: string }).description,
        updated_at: SAVED_AT,
      };
      topics.set(id, saved);
      return { status: created ? 201 : 200, body: saved };
    },
    'GET /api/orientacao/orientandos': (_body, url) => {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const items = advisees.map((advisee) => ({
        ...advisee,
        thesis_topic: topics.get(advisee.student.id)?.description ?? null,
      }));
      return {
        body: {
          items: items.slice(offset, offset + limit),
          count: items.length,
        },
      };
    },
    ...overrides,
  };
  return {
    routes,
    endAdvising: () => {
      advising = false;
    },
    topicOf: (studentId) =>
      studentId === undefined ? own : (topics.get(studentId) ?? null),
  };
}

export { makeAdvisee };
