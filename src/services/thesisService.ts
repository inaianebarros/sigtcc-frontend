import { nullOnNotFound } from './apiError';
import { httpClient } from './httpClient';

/** O tema do TCC da orientação ativa; os dois campos são `null` enquanto não há tema (RN12). */
export interface ThesisTopic {
  description: string | null;
  updatedAt: string | null;
}

interface ApiTopic {
  description: string | null;
  updated_at: string | null;
}

function topicFrom(topic: ApiTopic): ThesisTopic {
  return { description: topic.description, updatedAt: topic.updated_at };
}

export async function getMyTopic(): Promise<ThesisTopic> {
  return topicFrom(await httpClient.get<ApiTopic>('/tcc/tema'));
}

/** Grava ou substitui o tema: o servidor responde 201 ao criar e 200 ao alterar. */
export async function saveMyTopic(description: string): Promise<ThesisTopic> {
  return topicFrom(
    await httpClient.put<ApiTopic>('/tcc/tema', { description }),
  );
}

/** O tema de um orientando do professor, ou `null` num 404 (sem vínculo ativo, RN32). */
export async function getAdviseeTopic(
  studentId: number,
): Promise<ThesisTopic | null> {
  const topic = await nullOnNotFound(
    httpClient.get<ApiTopic>(`/tcc/orientandos/${studentId}/tema`),
  );
  return topic ? topicFrom(topic) : null;
}

export async function saveAdviseeTopic(
  studentId: number,
  description: string,
): Promise<ThesisTopic> {
  return topicFrom(
    await httpClient.put<ApiTopic>(`/tcc/orientandos/${studentId}/tema`, {
      description,
    }),
  );
}
