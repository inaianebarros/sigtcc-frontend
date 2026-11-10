import { httpClient } from './httpClient';

export const HISTORY_PAGE_SIZE = 20;

export interface EndedAdvising {
  id: number;
  /** A outra parte da orientação: o professor, para o aluno, e o aluno, para o professor. */
  counterpart: { id: number; fullName: string };
  startedAt: string;
  endedAt: string;
  /** O motivo do encerramento (RN33); o do sistema, quando uma conta foi desativada. */
  reason: string;
  /** O tema congelado da orientação (RN12), ou `null` se ela não teve tema. */
  thesisTopic: string | null;
}

export interface EndedAdvisingPage {
  items: EndedAdvising[];
  count: number;
}

interface ApiEndedAdvisingPage {
  items: ApiEndedAdvising[];
  count: number;
}

interface ApiEndedAdvising {
  id: number;
  counterpart: { id: number; full_name: string };
  started_at: string;
  ended_at: string;
  reason: string;
  thesis_topic: string | null;
}

/** O histórico do usuário (RF49): do encerramento mais recente para o mais antigo, paginado. */
export async function listAdvisingHistory(
  page: number,
): Promise<EndedAdvisingPage> {
  const params = new URLSearchParams({
    limit: String(HISTORY_PAGE_SIZE),
    offset: String((page - 1) * HISTORY_PAGE_SIZE),
  });
  const response = await httpClient.get<ApiEndedAdvisingPage>(
    `/orientacao/historico?${params}`,
  );
  return {
    count: response.count,
    items: response.items.map((item) => ({
      id: item.id,
      counterpart: {
        id: item.counterpart.id,
        fullName: item.counterpart.full_name,
      },
      startedAt: item.started_at,
      endedAt: item.ended_at,
      reason: item.reason,
      thesisTopic: item.thesis_topic,
    })),
  };
}
