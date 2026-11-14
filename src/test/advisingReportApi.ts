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
