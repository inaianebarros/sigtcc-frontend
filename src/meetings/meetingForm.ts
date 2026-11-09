import { z } from 'zod';

export const DESCRIPTION_MAX = 500;
export const FUTURE_MESSAGE = 'O horário deve ser futuro.';
export const ENDED_MESSAGE =
  'A orientação foi encerrada. A reunião não pode mais ser solicitada';

export interface MeetingFormValues {
  /** O aluno da reunião; só o professor o escolhe. */
  student: { id: number; name: string } | null;
  /** AAAA-MM-DD, como o campo de data nativo o devolve. */
  date: string;
  /** HH:MM, como o campo de hora nativo o devolve. */
  time: string;
  description: string;
}

// Santarém fica em UTC-3 o ano inteiro, sem horário de verão: a data e a hora do formulário são
// lidas nesse fuso, e não no do navegador, como o servidor as lê (RF17).
const SANTAREM_OFFSET = '-03:00';

/** O instante da data e da hora escritas no horário de Santarém, ou `null` se estiverem vazias. */
export function scheduledInstant(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const seconds = time.length === 5 ? `${time}:00` : time;
  const instant = new Date(`${date}T${seconds}${SANTAREM_OFFSET}`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * As regras do formulário de solicitar reunião (RF17 e RF18): data e hora informadas e no futuro,
 * descrição de 1 a 500 caracteres sem contar as pontas e, para o professor, o aluno escolhido.
 */
export function meetingFormSchema(isTeacher: boolean, now = () => new Date()) {
  return z
    .object({
      student: z.object({ id: z.number(), name: z.string() }).nullable(),
      date: z.string().min(1, 'Informe a data.'),
      time: z.string().min(1, 'Informe a hora.'),
      description: z
        .string()
        .trim()
        .min(1, 'Informe a descrição.')
        .max(
          DESCRIPTION_MAX,
          `A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`,
        ),
    })
    .superRefine((values, context) => {
      if (isTeacher && values.student === null) {
        context.addIssue({
          code: 'custom',
          path: ['student'],
          message: 'Escolha o aluno.',
        });
      }
      const instant = scheduledInstant(values.date, values.time);
      if (instant !== null && instant <= now()) {
        context.addIssue({
          code: 'custom',
          path: ['time'],
          message: FUTURE_MESSAGE,
        });
      }
    });
}
