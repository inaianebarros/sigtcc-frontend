import { STUDENT_ME, TEACHER_ME } from './dashboardApi';
import type { MockResponse } from './mockApi';

export interface FakeNotification {
  id: number;
  type: string;
  message: string;
  payload: Record<string, unknown>;
  reference: { type: string; id: number } | null;
  is_read: boolean;
  created_at: string;
}

type Handler = (
  body: unknown,
  url: URL,
  params: Record<string, string>,
) => MockResponse | Promise<MockResponse>;

export const ADMIN_ME = {
  id: 1,
  full_name: 'Administrador',
  email: 'admin@example.com',
  type: 'admin',
} as const;

export function makeNotification(
  id: number,
  overrides: Partial<FakeNotification> = {},
): FakeNotification {
  return {
    id,
    type: 'activity_created',
    message: `Notificação ${id}`,
    payload: {},
    reference: { type: 'activity', id: 42 },
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Notificações numeradas, da mais nova (id maior) para a mais antiga, como a API as devolve. */
export function numberedNotifications(
  count: number,
  overrides: Partial<FakeNotification> = {},
): FakeNotification[] {
  return Array.from({ length: count }, (_, index) =>
    makeNotification(count - index, overrides),
  );
}

export interface NotificationsServer {
  routes: Record<string, MockResponse | Handler>;
  /** O estado atual do servidor simulado. */
  notifications: () => FakeNotification[];
  /** Uma notificação que chega de fora, como a de outra pessoa, e vira a mais nova. */
  receive: (notification: FakeNotification) => void;
}

const SESSIONS = {
  student: STUDENT_ME,
  teacher: TEACHER_ME,
  admin: ADMIN_ME,
} as const;

/**
 * Um servidor de notificações simulado com estado: lista da mais nova para a mais antiga, com
 * `limit`, `offset` e o filtro `is_read`, a contagem de não lidas e as duas formas de marcar como
 * lida, como a API real (#51).
 */
export function notificationsServer(
  initial: FakeNotification[],
  user: keyof typeof SESSIONS = 'student',
  overrides: Record<string, MockResponse | Handler> = {},
): NotificationsServer {
  const state = initial.map((item) => structuredClone(item));
  const routes: Record<string, MockResponse | Handler> = {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': { body: SESSIONS[user] },
    'GET /api/notificacoes': (_body, url) => {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const isRead = url.searchParams.get('is_read');
      const matching = state.filter(
        (item) => isRead === null || item.is_read === (isRead === 'true'),
      );
      return {
        body: {
          items: matching.slice(offset, offset + limit),
          count: matching.length,
        },
      };
    },
    'GET /api/notificacoes/nao-lidas/contagem': () => ({
      body: { count: state.filter((item) => !item.is_read).length },
    }),
    'PATCH /api/notificacoes/todas-lidas': () => {
      const unread = state.filter((item) => !item.is_read);
      for (const item of unread) item.is_read = true;
      return { body: { count: unread.length } };
    },
    'PATCH /api/notificacoes/:id/lida': (_body, _url, params) => {
      const found = state.find((item) => item.id === Number(params.id));
      if (!found) {
        return { status: 404, body: { detail: 'Notificação não encontrada.' } };
      }
      found.is_read = true;
      return { body: found };
    },
    ...overrides,
  };
  return {
    routes,
    notifications: () => state,
    receive: (notification) => {
      state.unshift(notification);
    },
  };
}
