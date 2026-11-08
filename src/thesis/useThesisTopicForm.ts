import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { TOPIC_MAX, TOPIC_MIN, thesisSchema } from './thesisForm';
import type { ThesisFormValues } from './thesisForm';

/**
 * O formulário único do tema (RF23 e RF24): serve para cadastrar e para alterar. `saved` é o
 * último tema gravado, já sem as pontas. Há alteração pendente (RNF28) quando o texto aparado
 * difere dele, e só então, com o tamanho válido, o botão de salvar é habilitado. Com `ready`
 * falso o formulário espera o tema chegar.
 */
export function useThesisTopicForm(saved: string, ready = true) {
  const form = useForm<ThesisFormValues>({
    resolver: zodResolver(thesisSchema),
    mode: 'onChange',
    defaultValues: { description: saved },
    // Quando o tema chega depois (a leitura do diálogo do professor), o formulário parte dele.
    values: ready ? { description: saved } : undefined,
  });
  const trimmed = useWatch({
    control: form.control,
    name: 'description',
  }).trim();
  const pending = trimmed !== saved;
  const validLength =
    trimmed.length >= TOPIC_MIN && trimmed.length <= TOPIC_MAX;
  return { form, trimmed, pending, canSave: pending && validLength };
}
