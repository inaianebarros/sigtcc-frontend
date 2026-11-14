import { historyRoutes, type FakeEndedAdvising } from './advisingHistoryApi';
import type { MockResponse } from './mockApi';

export interface FakeAdvisingReport {
  id: number;
  counterpart: { id: number; full_name: string };
  started_at: string;
  ended_at: string;
  reason: string;
  thesis_topic: string | null;
  records_count: number;
  meetings_count: number;
  activities_count: number;
}

export function makeAdvisingReport(
  id: number,
  overrides: Partial<FakeAdvisingReport> = {},
): FakeAdvisingReport {
  return {
    id,
    counterpart: { id: 100 + id, full_name: `Pessoa ${id}` },
    started_at: '2026-08-03T14:30:00Z',
    ended_at: '2026-11-02T14:30:00Z',
    reason: `Concluímos o ciclo da orientação ${id}.`,
    thesis_topic: `Tema da orientação ${id}`,
    records_count: 5,
    meetings_count: 3,
    activities_count: 2,
    ...overrides,
  };
}

type Handler = MockResponse | ((body: unknown, url: URL) => MockResponse);

/**
 * Um servidor simulado do relatório de cada orientação dada; qualquer outro id cai no 404, como o
 * do servidor real (orientação de outra pessoa, ativa ou inexistente). Traz também as rotas do
 * histórico, para o "Voltar" e a navegação a partir dele.
 */
export function reportRoutes(
  reports: FakeAdvisingReport[],
  user: 'student' | 'teacher' = 'student',
  override?: Handler,
  history: FakeEndedAdvising[] = [],
): Record<string, Handler> {
  return {
    ...historyRoutes(history, user),
    ...Object.fromEntries(
      reports.map((report) => [
        `GET /api/orientacao/historico/${report.id}/relatorio`,
        override ?? { body: report },
      ]),
    ),
  };
}

export interface FakeMeetingRecord {
  type: 'meeting';
  id: number;
  date: string;
  starts_at: string;
  ends_at: string;
  description: string;
  notes: string;
}

export interface FakeActivityRecord {
  type: 'activity';
  id: number;
  date: string;
  deadline: string;
  title: string;
  description: string;
  status: 'completed' | 'archived';
}

export type FakeRecord = FakeMeetingRecord | FakeActivityRecord;

export function makeMeetingRecord(
  id: number,
  overrides: Partial<FakeMeetingRecord> = {},
): FakeMeetingRecord {
  return {
    type: 'meeting',
    id,
    date: '2026-10-20',
    starts_at: '2026-10-20T10:00:00-03:00',
    ends_at: '2026-10-20T11:30:00-03:00',
    description: `Descrição da reunião ${id}.`,
    notes: `Apontamentos da reunião ${id}.`,
    ...overrides,
  };
}

export function makeActivityRecord(
  id: number,
  overrides: Partial<FakeActivityRecord> = {},
): FakeActivityRecord {
  return {
    type: 'activity',
    id,
    date: '2026-10-25',
    deadline: '2026-10-25',
    title: `Atividade ${id}`,
    description: `Descrição da atividade ${id}.`,
    status: 'completed',
    ...overrides,
  };
}

/**
 * O feed de registros de uma orientação, como o servidor real: filtra por `type`, pagina por
 * `limit` e `offset` (10 por padrão) e mantém a ordem recebida. `count` é o total do filtro.
 */
export function recordsRoutes(
  advisingId: number,
  records: FakeRecord[],
  override?: Handler,
): Record<string, Handler> {
  return {
    [`GET /api/orientacao/historico/${advisingId}/registros`]:
      override ??
      ((_body, url) => {
        const type = url.searchParams.get('type');
        const limit = Number(url.searchParams.get('limit') ?? 10);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const found = records.filter((record) => !type || record.type === type);
        return {
          body: {
            items: found.slice(offset, offset + limit),
            count: found.length,
          },
        };
      }),
  };
}
