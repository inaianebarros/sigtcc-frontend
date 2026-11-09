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

/** A data (AAAA-MM-DD) e a hora (HH:MM) de um instante, no horário de Santarém, como os campos nativos as pedem. */
export function santaremParts(iso: string): { date: string; time: string } {
  const instant = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  const text = instant.toISOString();
  return { date: text.slice(0, 10), time: text.slice(11, 16) };
}

/**
 * As regras do formulário de reunião (RF17, RF18 e RF21): data e hora informadas e no futuro,
 * descrição de 1 a 500 caracteres sem contar as pontas e, quando `requireStudent`, o aluno
 * escolhido. Na edição, `original` é o horário atual: o futuro só é exigido se ele mudar.
 */
export function meetingFormSchema(
  requireStudent: boolean,
  now = () => new Date(),
  original?: { date: string; time: string },
) {
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
      if (requireStudent && values.student === null) {
        context.addIssue({
          code: 'custom',
          path: ['student'],
          message: 'Escolha o aluno.',
        });
      }
      const instant = scheduledInstant(values.date, values.time);
      const unchanged =
        original !== undefined &&
        values.date === original.date &&
        values.time === original.time;
      if (!unchanged && instant !== null && instant <= now()) {
        context.addIssue({
          code: 'custom',
          path: ['time'],
          message: FUTURE_MESSAGE,
        });
      }
    });
}

export type ReasonNoun = 'justificativa' | 'motivo';

/** A justificativa da recusa (RN11) ou o motivo do cancelamento (RN10): de 1 a 500 caracteres sem as pontas. */
export function reasonFormSchema(noun: ReasonNoun) {
  return z.object({
    reason: z
      .string()
      .trim()
      .min(1, `Informe ${noun === 'motivo' ? 'o' : 'a'} ${noun}.`)
      .max(
        DESCRIPTION_MAX,
        `${noun === 'motivo' ? 'O' : 'A'} ${noun} deve ter no máximo ${DESCRIPTION_MAX} caracteres.`,
      ),
  });
}
