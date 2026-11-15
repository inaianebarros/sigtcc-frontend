import { Stack, TextField, Typography } from '@mui/material';
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
}

/** O campo do tema com o aviso de alterações não salvas no topo e o contador de caracteres. */
export function ThesisTopicField({
  form,
  length,
  pending,
  disabled = false,
  readOnly = false,
  describedBy,
}: ThesisTopicFieldProps) {
  const error = form.formState.errors.description?.message;
  return (
    <Stack spacing={1}>
      <PendingChangesNotice visible={pending} />
      <TextField
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
        {...form.register('description')}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ alignSelf: 'flex-end' }}
      >
        {length}/{TOPIC_MAX}
      </Typography>
    </Stack>
  );
}
