import { nullOnNotFound } from './apiError';
import { httpClient } from './httpClient';

export interface AdvisingReport {
  id: number;
  /** A outra parte da orientação: o professor, para o aluno, e o aluno, para o professor. */
  counterpart: { id: number; fullName: string };
  startedAt: string;
  endedAt: string;
  /** O motivo do encerramento (RN33); o do sistema, quando uma conta foi desativada. */
  reason: string;
  /** O tema congelado da orientação (RN12), ou `null` se ela não teve tema. */
  thesisTopic: string | null;
  /** Os totais gerais: o de registros é a soma de reuniões e atividades. */
  recordsCount: number;
  meetingsCount: number;
  activitiesCount: number;
}

interface ApiAdvisingReport {
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

/**
 * O cabeçalho e os totais do relatório de uma orientação encerrada (RF61). O servidor responde o
 * mesmo 404 para uma orientação de outra pessoa, uma ainda ativa e um id que não existe (RN47), e
 * aqui isso vira `null`.
 */
export async function getAdvisingReport(
  advisingId: number,
): Promise<AdvisingReport | null> {
  const report = await nullOnNotFound(
    httpClient.get<ApiAdvisingReport>(
      `/orientacao/historico/${advisingId}/relatorio`,
    ),
  );
  if (report === null) return null;
  return {
    id: report.id,
    counterpart: {
      id: report.counterpart.id,
      fullName: report.counterpart.full_name,
    },
    startedAt: report.started_at,
    endedAt: report.ended_at,
    reason: report.reason,
    thesisTopic: report.thesis_topic,
    recordsCount: report.records_count,
    meetingsCount: report.meetings_count,
    activitiesCount: report.activities_count,
  };
}
