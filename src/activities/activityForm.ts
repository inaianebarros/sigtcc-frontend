import { z } from 'zod';

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;
export const PAST_DEADLINE_MESSAGE = 'O prazo não pode ser anterior a hoje.';

export interface ActivityFormValues {
  /** O aluno, em texto como o campo o guarda; só a criação o pede. */
  studentId: string;
  title: string;
  description: string;
  /** AAAA-MM-DD, como o campo de data nativo o devolve; vazio enquanto incompleto. */
  deadline: string;
}

/** A data de hoje no calendário do navegador, no formato do campo de data (AAAA-MM-DD). */
export function todayInput(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface SchemaOptions {
  mode: 'create' | 'edit';
  /** O prazo que a atividade já tem: só um prazo diferente dele precisa ser de hoje em diante. */
  initialDeadline: string;
  today?: string;
}

/**
 * As regras do formulário, as mesmas que o servidor aplica (RF25 e RF26): título de 1 a 200 e
 * descrição de 1 a 2000 caracteres sem contar os espaços das pontas, e um prazo de hoje em
 * diante quando é novo ou foi alterado.
 */
export function activityFormSchema({
  mode,
  initialDeadline,
  today = todayInput(),
}: SchemaOptions) {
  return z.object({
    studentId:
      mode === 'create' ? z.string().min(1, 'Escolha o aluno.') : z.string(),
    title: z
      .string()
      .trim()
      .min(1, 'Informe o título.')
      .max(TITLE_MAX, `O título deve ter no máximo ${TITLE_MAX} caracteres.`),
    description: z
      .string()
      .trim()
      .min(1, 'Informe a descrição.')
      .max(
        DESCRIPTION_MAX,
        `A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`,
      ),
    deadline: z
      .string()
      .min(1, 'Informe o prazo.')
      .refine(
        (value) => value === initialDeadline || value >= today,
        PAST_DEADLINE_MESSAGE,
      ),
  });
}
