import { httpClient } from './httpClient';

/** O Aluno da atividade ou o seu orientador comenta (RF32); o comentário é imutável. */
export async function addComment(
  activityId: number,
  text: string,
): Promise<void> {
  await httpClient.post(`/atividades/${activityId}/comentarios`, { text });
}
