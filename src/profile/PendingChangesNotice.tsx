import { Alert, Box } from '@mui/material';

/** A região fica sempre montada: o leitor de tela só anuncia o texto que entra numa região já existente. */
export function PendingChangesNotice({
  visible,
  actionLabel = 'Salvar',
}: {
  visible: boolean;
  /** O nome do botão que grava, quando não é "Salvar" (por exemplo, "Solicitar"). */
  actionLabel?: string;
}) {
  return (
    <Box role="status" aria-live="polite">
      {visible && (
        <Alert severity="warning" role="presentation">
          Você tem alterações não salvas. Clique em {actionLabel} para
          gravá-las.
        </Alert>
      )}
    </Box>
  );
}
