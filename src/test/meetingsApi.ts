import type { FakeAdvisee } from './adviseesApi';
import type { MockResponse } from './mockApi';

export interface FakeMeeting {
  id: number;
  scheduled_at: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  situation:
    'pending' | 'accepted' | 'rejected' | 'cancelled' | 'held' | 'expired';
  author: { id: number; full_name: string; type: 'student' | 'teacher' };
  counterpart: { id: number; full_name: string };
  rejection_reason: string;
  cancellation_reason: string;
  cancelled_by_system: boolean;
  can_answer: boolean;
  can_edit: boolean;
  can_cancel: boolean;
  /** O aluno da reunião, para o filtro do professor (não faz parte do contrato do item). */
  student_id?: number;
}

export function makeMeeting(
  id: number,
  overrides: Partial<FakeMeeting> = {},
): FakeMeeting {
  return {
    id,
    scheduled_at: '2099-12-31T14:30:00-03:00',
    description: `Reunião ${id} de orientação`,
    status: 'pending',
    situation: 'pending',
    author: { id: 7, full_name: 'Ana Souza', type: 'student' },
    counterpart: { id: 9, full_name: 'Carlos Lima' },
    rejection_reason: '',
    cancellation_reason: '',
    cancelled_by_system: false,
    can_answer: false,
    can_edit: true,
    can_cancel: true,
    ...overrides,
  };
}

type Handler = (
  body: unknown,
  url: URL,
  params: Record<string, string>,
) => MockResponse | Promise<MockResponse>;

interface ServerOptions {
  user: 'student' | 'teacher';
  /** O aluno tem orientação ativa? O professor, orientandos ativos? */
  active?: boolean;
  /** Os orientandos do professor, para o seletor do aluno (com busca pelo nome). */
  advisees?: FakeAdvisee[];
  overrides?: Record<string, MockResponse | Handler>;
}

export interface MeetingsServer {
  routes: Record<string, MockResponse | Handler>;
  meetings: () => FakeMeeting[];
  endAdvising: () => void;
}

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Um servidor de reuniões simulado com estado: filtra e pagina como a API real, mantém a ordem
 * recebida, grava a solicitação e informa a orientação em /auth/me.
 */
export function meetingsServer(
  initial: FakeMeeting[],
  { user, active = true, advisees = [], overrides = {} }: ServerOptions,
): MeetingsServer {
  const state = initial.map((item) => structuredClone(item));
  let advising = active;
  let nextId = Math.max(0, ...initial.map((item) => item.id)) + 1;
  const routes: Record<string, MockResponse | Handler> = {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': () => ({
      body:
        user === 'student'
          ? {
              id: 7,
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
              active_advisees_count: advising
                ? Math.max(1, advisees.length)
                : 0,
            },
    }),
    'GET /api/reunioes': (_body, url) => {
      const situation = url.searchParams.get('situation');
      const from = url.searchParams.get('date_from');
      const to = url.searchParams.get('date_to');
      const studentId = url.searchParams.get('student_id');
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const matching = state.filter((item) => {
        const day = item.scheduled_at.slice(0, 10);
        return (
          (situation === null || item.situation === situation) &&
          (from === null || day >= from) &&
          (to === null || day <= to) &&
          (studentId === null || item.student_id === Number(studentId))
        );
      });
      return {
        body: {
          items: matching.slice(offset, offset + limit).map((item) => {
            const { student_id: _studentId, ...contract } = item;
            void _studentId;
            return contract;
          }),
          count: matching.length,
        },
      };
    },
    'POST /api/reunioes': (body) => {
      const input = body as {
        date: string;
        time: string;
        description: string;
        student_id?: number;
      };
      const created = makeMeeting(nextId++, {
        scheduled_at: `${input.date}T${input.time}:00-03:00`,
        description: input.description,
        author:
          user === 'student'
            ? { id: 7, full_name: 'Ana Souza', type: 'student' }
            : { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
        student_id: input.student_id,
      });
      state.unshift(created);
      return { status: 201, body: created };
    },
    'POST /api/reunioes/:id/responder': (body, _url, params) => {
      const found = state.find((item) => item.id === Number(params.id));
      if (!found)
        return { status: 404, body: { detail: 'Reunião não encontrada.' } };
      const input = body as { action: 'accept' | 'reject'; reason?: string };
      found.can_answer = false;
      if (input.action === 'accept') {
        found.status = 'accepted';
        found.situation = 'accepted';
        found.can_cancel = true;
      } else {
        found.status = 'rejected';
        found.situation = 'rejected';
        found.rejection_reason = input.reason ?? '';
        found.can_edit = false;
        found.can_cancel = false;
      }
      return { body: found };
    },
    'PATCH /api/reunioes/:id': (body, _url, params) => {
      const found = state.find((item) => item.id === Number(params.id));
      if (!found)
        return { status: 404, body: { detail: 'Reunião não encontrada.' } };
      const input = body as {
        date?: string;
        time?: string;
        description?: string;
      };
      if (input.date !== undefined || input.time !== undefined) {
        const day = input.date ?? found.scheduled_at.slice(0, 10);
        const hour = input.time ?? found.scheduled_at.slice(11, 16);
        found.scheduled_at = `${day}T${hour}:00-03:00`;
        // RN39: mudar a data ou a hora de uma reunião aceita a devolve para pendente.
        if (found.situation === 'accepted') {
          found.status = 'pending';
          found.situation = 'pending';
        }
      }
      if (input.description !== undefined)
        found.description = input.description;
      return { body: found };
    },
    'POST /api/reunioes/:id/cancelar': (body, _url, params) => {
      const found = state.find((item) => item.id === Number(params.id));
      if (!found)
        return { status: 404, body: { detail: 'Reunião não encontrada.' } };
      found.status = 'cancelled';
      found.situation = 'cancelled';
      found.cancellation_reason = (body as { reason: string }).reason;
      found.can_answer = false;
      found.can_edit = false;
      found.can_cancel = false;
      return { body: found };
    },
    'GET /api/orientacao/orientandos': (_body, url) => {
      const search = plain(url.searchParams.get('search') ?? '');
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const matching = advisees.filter((advisee) =>
        plain(advisee.student.full_name).includes(search),
      );
      return {
        body: {
          items: matching.slice(offset, offset + limit),
          count: matching.length,
        },
      };
    },
    ...overrides,
  };
  return {
    routes,
    meetings: () => state,
    endAdvising: () => {
      advising = false;
    },
  };
}
