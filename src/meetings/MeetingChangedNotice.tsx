import { Alert, Box } from '@mui/material';

/**
 * O aviso, num diálogo aberto, de que a reunião mudou ou saiu do calendário na releitura (ADR
 * frontend 0006). O diálogo continua aberto e com o que foi digitado. A região fica sempre montada
 * e o texto só muda quando a reunião muda: o leitor de tela anuncia cada mudança uma vez, e nada a
 * cada releitura.
 */
export function MeetingChangedNotice({ message }: { message: string | null }) {
  return (
    <Box role="status" aria-live="polite">
      {message !== null && (
        <Alert severity="warning" role="presentation">
          {message}
        </Alert>
      )}
    </Box>
  );
}
