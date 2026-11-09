import { httpClient } from './httpClient';

export const COMMENTS_PAGE_SIZE = 20;

export type CommentAuthorType = 'student' | 'teacher';

export interface ActivityComment {
  id: number;
  /** Texto simples: a tela o mostra como texto, com as quebras de linha (RF32). */
  text: string;
  /** O instante com o fuso, como o servidor o devolve. */
  createdAt: string;
  author: { id: number; fullName: string; type: CommentAuthorType };
}

/** Um trecho da lista, do mais antigo para o mais novo, com o total de comentários. */
export interface CommentSlice {
  items: ActivityComment[];
  count: number;
}

interface ApiComment {
  id: number;
  text: string;
  created_at: string;
  author: { id: number; full_name: string; type: CommentAuthorType };
}

function commentFrom(comment: ApiComment): ActivityComment {
  return {
    id: comment.id,
    text: comment.text,
    createdAt: comment.created_at,
    author: {
      id: comment.author.id,
      fullName: comment.author.full_name,
      type: comment.author.type,
    },
  };
}

/** Lê `limit` comentários a partir de `offset`; o servidor os ordena do mais antigo ao mais novo. */
export async function listComments(
  activityId: number,
  { limit, offset }: { limit: number; offset: number },
): Promise<CommentSlice> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await httpClient.get<{
    items: ApiComment[];
    count: number;
  }>(`/atividades/${activityId}/comentarios?${params}`);
  return { items: response.items.map(commentFrom), count: response.count };
}

/** O Aluno da atividade ou o seu orientador comenta (RF32); o comentário é imutável. */
export async function addComment(
  activityId: number,
  text: string,
): Promise<ActivityComment> {
  return commentFrom(
    await httpClient.post<ApiComment>(`/atividades/${activityId}/comentarios`, {
      text,
    }),
  );
}
