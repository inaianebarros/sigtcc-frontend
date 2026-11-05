import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, messageForStatus } from '../services/apiError';

/** Leva cada erro da API ao seu campo; devolve o texto do alerta do formulário, se houver. */
export function reportRegistrationError<T extends FieldValues>(
  error: unknown,
  fieldByApiField: Record<string, Path<T>>,
  setError: UseFormSetError<T>,
): string | null {
  if (!(error instanceof ApiError)) return messageForStatus(0);
  const unmapped: string[] = [];
  for (const [apiField, message] of Object.entries(error.fieldErrors)) {
    const field = fieldByApiField[apiField];
    if (field) setError(field, { message }, { shouldFocus: true });
    else unmapped.push(message);
  }
  if (Object.keys(error.fieldErrors).length === 0 || unmapped.length > 0) {
    return unmapped[0] ?? error.message;
  }
  return null;
}
