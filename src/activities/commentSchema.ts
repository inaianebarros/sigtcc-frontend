import { z } from 'zod';

export const COMMENT_MAX = 1000;

/** O comentário: de 1 a 1000 caracteres sem as pontas, texto simples (RF32). */
export const commentSchema = z
  .string()
  .trim()
  .min(1, 'Escreva o comentário.')
  .max(
    COMMENT_MAX,
    `O comentário deve ter no máximo ${COMMENT_MAX} caracteres.`,
  );
