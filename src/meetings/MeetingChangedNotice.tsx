import { Alert, Box } from '@mui/material';
import {
  MEETING_CHANGED_MESSAGE,
  MEETING_GONE_MESSAGE,
} from './meetingFreshness';
import type { MeetingFreshness } from './meetingFreshness';

/**
 * O aviso, num diálogo aberto, de que a reunião mudou ou saiu do calendário na releitura (ADR
 * frontend 0006). O diálogo continua aberto e com o que foi digitado. A região fica sempre montada:
 * o leitor de tela anuncia o aviso uma vez, quando ele entra ou troca de texto.
 */
export function MeetingChangedNotice({
  freshness,
}: {
  freshness: MeetingFreshness;
}) {
  return (
    <Box role="status" aria-live="polite">
      {freshness !== 'same' && (
        <Alert severity="warning" role="presentation">
          {freshness === 'gone'
            ? MEETING_GONE_MESSAGE
            : MEETING_CHANGED_MESSAGE}
        </Alert>
      )}
    </Box>
  );
}
