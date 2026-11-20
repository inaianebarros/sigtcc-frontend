import { Alert, Box } from '@mui/material';

/**
 * O aviso, num diálogo aberto, de que o que ele mostra mudou na releitura da tela (ADR frontend
 * 0006), como uma reunião remarcada ou uma atividade concluída. O diálogo continua aberto e com o
 * que foi digitado. A região fica sempre montada e o texto só muda quando o dado muda: o leitor de
 * tela anuncia cada mudança uma vez, e nada a cada releitura.
 */
export function ChangedNotice({ message }: { message: string | null }) {
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
