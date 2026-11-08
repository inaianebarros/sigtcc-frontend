import { z } from 'zod';

export const TOPIC_MIN = 10;
export const TOPIC_MAX = 1000;
export const TOPIC_RANGE_MESSAGE = `Informe de ${TOPIC_MIN} a ${TOPIC_MAX} caracteres`;

export interface ThesisFormValues {
  description: string;
}

/** O tema tem de 10 a 1000 caracteres, sem contar os espaços das pontas (RF23 e RF24). */
export const thesisSchema = z.object({
  description: z
    .string()
    .trim()
    .min(TOPIC_MIN, TOPIC_RANGE_MESSAGE)
    .max(TOPIC_MAX, TOPIC_RANGE_MESSAGE),
});
