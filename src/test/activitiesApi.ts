import type { FakeAdvisee } from './adviseesApi';
import type { MockResponse } from './mockApi';

export interface FakeActivity {
  id: number;
  title: string;
  description: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'in_review' | 'completed';
  overdue: boolean;
  student: { id: number; full_name: string };
  created_at: string;
  teacher?: { id: number; full_name: string } | null;
  submissions: {
    id: number;
    submitted_at: string;
    files: {
      id: number;
      file_name: string;
      size_bytes: number;
      content_type: string;
    }[];
  }[];
  reviews: {
    id: number;
    decision: 'accepted' | 'rejected';
    /** Vazia no aceite (RN40); os testes antigos a omitem. */
    justification?: string;
    decided_at: string;
  }[];
  comments_count: number;
}

export function makeActivity(
  id: number,
  overrides: Partial<FakeActivity> = {},
): FakeActivity {
  return {
    id,
    title: `Atividade ${id}`,
    description: `Descrição da atividade ${id}`,
    deadline: '2099-12-31',
    status: 'pending',
    overdue: false,
    student: { id: 101, full_name: 'Orientando 1' },
    created_at: '2026-11-02T14:30:00Z',
    teacher: { id: 9, full_name: 'Carlos Lima' },
    submissions: [],
    reviews: [],
    comments_count: 0,
    ...overrides,
  };
}

type Handler = (
  body: unknown,
  url: URL,
  params: Record<string, string>,
) => MockResponse | Promise<MockResponse>;

export interface ActivitiesServer {
  routes: Record<string, MockResponse | Handler>;
  /** O estado atual do servidor simulado, para os testes conferirem o que foi gravado. */
  activities: () => FakeActivity[];
}

interface ServerOptions {
  user: 'student' | 'teacher';
  /** Os orientandos do professor, para a seleção do aluno na criação (paginados como a API). */
  advisees?: FakeAdvisee[];
  /** Substitui uma rota inteira, como uma falha ou um 409. */
  overrides?: Record<string, MockResponse | Handler>;
}

const ME = {
  student: {
    id: 7,
    full_name: 'Ana Souza',
    email: 'ana@example.com',
    type: 'student',
    has_active_advising: true,
  },
  teacher: {
    id: 9,
    full_name: 'Carlos Lima',
    email: 'carlos@example.com',
    type: 'teacher',
    active_advisees_count: 2,
  },
} as const;

/**
 * Um servidor de atividades simulado com estado: filtra, pagina e mantém a ordem recebida como
 * a API real, e grava a criação, a edição e a exclusão para a lista seguinte as refletir.
 */
export function activitiesServer(
  initial: FakeActivity[],
  { user, advisees = [], overrides = {} }: ServerOptions,
): ActivitiesServer {
  // Cópias: o PATCH muda a atividade, e um dado compartilhado entre testes vazaria o estado.
  const state = initial.map((item) => structuredClone(item));
  let nextId = Math.max(0, ...initial.map((item) => item.id)) + 1;
  const routes: Record<string, MockResponse | Handler> = {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': { body: ME[user] },
    'GET /api/orientacao/orientandos': (_body, url) => {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return {
        body: {
          items: advisees.slice(offset, offset + limit),
          count: advisees.length,
        },
      };
    },
    'GET /api/atividades': (_body, url) => {
      const status = url.searchParams.get('status');
      const overdue = url.searchParams.get('overdue');
      const studentId = url.searchParams.get('student_id');
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const matching = state.filter(
        (item) =>
          (status === null || item.status === status) &&
          (overdue !== 'true' || item.overdue) &&
          (studentId === null || item.student.id === Number(studentId)),
      );
      return {
        body: {
          items: matching.slice(offset, offset + limit).map((item) => ({
            id: item.id,
            title: item.title,
            deadline: item.deadline,
            status: item.status,
            overdue: item.overdue,
            student: item.student,
          })),
          count: matching.length,
        },
      };
    },
    // Os totais gerais: não recebem filtros, então a busca e os filtros da lista nunca os alteram.
    'GET /api/atividades/resumo': () => ({
      body: {
        total: state.length,
        pending: state.filter((item) => item.status === 'pending').length,
        completed: state.filter((item) => item.status === 'completed').length,
      },
    }),
    'GET /api/atividades/:id': (_body, _url, params) => {
      const found = state.find((item) => item.id === Number(params.id));
      return found
        ? { body: found }
        : { status: 404, body: { detail: 'Atividade não encontrada.' } };
    },
    'POST /api/atividades': (body) => {
      const input = body as {
        student_id: number;
        title: string;
        description: string;
        deadline: string;
      };
      const created = makeActivity(nextId++, {
        title: input.title,
        description: input.description,
        deadline: input.deadline,
        student: {
          id: input.student_id,
          full_name: `Orientando ${input.student_id}`,
        },
      });
      state.push(created);
      return { status: 201, body: created };
    },
    'PATCH /api/atividades/:id': (body, _url, params) => {
      const found = state.find((item) => item.id === Number(params.id));
      if (!found)
        return { status: 404, body: { detail: 'Atividade não encontrada.' } };
      Object.assign(found, body);
      return { body: found };
    },
    'PATCH /api/atividades/:id/status': (body, _url, params) => {
      const found = state.find((item) => item.id === Number(params.id));
      if (!found)
        return { status: 404, body: { detail: 'Atividade não encontrada.' } };
      const { status } = body as { status: FakeActivity['status'] };
      if (found.status === 'in_review' || found.status === 'completed') {
        return {
          status: 409,
          body: {
            detail:
              found.status === 'in_review'
                ? 'Esta atividade está em revisão e só o orientador pode alterar o status.'
                : 'Esta atividade já foi concluída e não pode ser alterada.',
          },
        };
      }
      if (status === 'in_review' && found.submissions.length === 0) {
        return {
          status: 409,
          body: {
            detail:
              'Envie ao menos uma entrega antes de enviar a atividade para revisão.',
          },
        };
      }
      found.status = status;
      return {
        body: {
          id: found.id,
          title: found.title,
          deadline: found.deadline,
          status: found.status,
          overdue: found.overdue,
          student: found.student,
        },
      };
    },
    'POST /api/atividades/:id/revisar': (body, _url, params) => {
      const found = state.find((item) => item.id === Number(params.id));
      if (!found)
        return { status: 404, body: { detail: 'Atividade não encontrada.' } };
      if (found.status !== 'in_review') {
        return {
          status: 409,
          body: { detail: 'Só uma atividade em revisão pode ser revisada.' },
        };
      }
      const { decision, justification = '' } = body as {
        decision: 'accepted' | 'rejected';
        justification?: string;
      };
      found.reviews.push({
        id: found.reviews.length + 1,
        decision,
        justification,
        decided_at: '2026-11-09T12:00:00Z',
      });
      found.status = decision === 'accepted' ? 'completed' : 'pending';
      return {
        body: {
          id: found.id,
          title: found.title,
          deadline: found.deadline,
          status: found.status,
          overdue: found.overdue,
          student: found.student,
        },
      };
    },
    'GET /api/atividades/:id/arquivos/:fileId': (_body, _url, params) => {
      const found = state.find((item) => item.id === Number(params.id));
      const file = found?.submissions
        .flatMap((submission) => submission.files)
        .find((item) => item.id === Number(params.fileId));
      return file
        ? {
            rawBody: `conteúdo de ${file.file_name}`,
            headers: { 'Content-Type': file.content_type },
          }
        : { status: 404, body: { detail: 'Arquivo não encontrado.' } };
    },
    'DELETE /api/atividades/:id': (_body, _url, params) => {
      const index = state.findIndex((item) => item.id === Number(params.id));
      if (index < 0)
        return { status: 404, body: { detail: 'Atividade não encontrada.' } };
      state.splice(index, 1);
      return { status: 204 };
    },
    ...overrides,
  };
  return { routes, activities: () => state };
}
