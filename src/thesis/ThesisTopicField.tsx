import { Box, Stack, TextField, Typography } from '@mui/material';
import type { UseFormReturn } from 'react-hook-form';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { TOPIC_MAX } from './thesisForm';
import type { ThesisFormValues } from './thesisForm';

interface ThesisTopicFieldProps {
  form: UseFormReturn<ThesisFormValues>;
  /** O tamanho do texto aparado, para o contador. */
  length: number;
  pending: boolean;
  disabled?: boolean;
  /** Somente leitura: o texto continua legível e focável, mas não muda (o tema congelado, RN12). */
  readOnly?: boolean;
  /** O id do texto que explica por que o campo está bloqueado. */
  describedBy?: string;
  /**
   * Quando informado, o aviso de alteração pendente vira esta frase discreta, abaixo do campo, no
   * lugar do alerta do topo: é o caso do tema dentro do perfil, que grava por conta própria.
   */
  pendingHint?: string;
  /** O `id` da caixa de texto, para quem precisa levar o foco a ela. */
  inputId?: string;
}

/** O campo do tema com o aviso de alterações não salvas no topo e o contador de caracteres. */
export function ThesisTopicField({
  form,
  length,
  pending,
  disabled = false,
  readOnly = false,
  describedBy,
  pendingHint,
  inputId,
}: ThesisTopicFieldProps) {
  const error = form.formState.errors.description?.message;
  // O `ref` do campo é o da caixa de texto: `setFocus` e o foco no erro precisam dele, e não da raiz.
  const { ref, ...register } = form.register('description');
  return (
    <Stack spacing={1}>
      {pendingHint === undefined && <PendingChangesNotice visible={pending} />}
      <TextField
        id={inputId}
        label="Tema do TCC"
        multiline
        minRows={4}
        disabled={disabled}
        slotProps={{
          input: { readOnly },
          htmlInput: { 'aria-describedby': describedBy },
        }}
        error={Boolean(error)}
        helperText={error}
        inputRef={ref}
        {...register}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ alignSelf: 'flex-end' }}
      >
        {length}/{TOPIC_MAX}
      </Typography>
      {pendingHint !== undefined && (
        // A região fica sempre montada: o leitor de tela só anuncia o texto que entra numa região já existente.
        <Box role="status" aria-live="polite">
          {pending && (
            <Typography variant="body2" sx={{ color: 'warning.main' }}>
              {pendingHint}
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );
}
