import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useId, useState } from 'react';

const REASON_MIN = 10;
const REASON_MAX = 500;

/**
 * O servidor valida o tamanho do motivo com a mensagem padrão do Pydantic, em inglês. A tela já
 * valida antes de enviar, então este texto só aparece se o servidor recusar mesmo assim.
 */
export const REASON_REJECTED_MESSAGE = `O motivo deve ter de ${REASON_MIN} a ${REASON_MAX} caracteres.`;

interface EndAdvisingDialogProps {
  open: boolean;
  studentName: string;
  /** Enquanto o pedido está em andamento, nada pode ser enviado de novo nem fechado. */
  busy: boolean;
  /** A falha que não é do motivo: aparece como alerta, com o texto preservado. */
  failure: string | null;
  /** A mensagem do servidor sobre o motivo: aparece no próprio campo. */
  reasonError: string | null;
  /** O professor voltou a editar o motivo: a falha e o erro anteriores deixam de valer. */
  onEdit: () => void;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  onExited: () => void;
}

/**
 * A confirmação do encerramento (RN30, RN33, RNF21). O motivo vive aqui dentro: quem usa troca
 * a `key` a cada abertura para o campo começar vazio.
 */
export function EndAdvisingDialog({
  open,
  studentName,
  busy,
  failure,
  reasonError,
  onEdit,
  onCancel,
  onConfirm,
  onExited,
}: EndAdvisingDialogProps) {
  const id = useId();
  const [reason, setReason] = useState('');
  // Os espaços das pontas não contam e não são enviados (RN33).
  const trimmed = reason.trim();
  const tooLong = trimmed.length > REASON_MAX;
  const valid = trimmed.length >= REASON_MIN && !tooLong;
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      fullWidth
      maxWidth="sm"
      slotProps={{ transition: { onExited } }}
    >
      <DialogTitle id={`${id}-title`}>
        Encerrar a orientação de {studentName}?
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText id={`${id}-message`}>
            Esta ação não pode ser desfeita. As atividades pendentes, em
            andamento ou em revisão serão arquivadas. As reuniões pendentes ou
            aceitas ainda não realizadas serão canceladas.
          </DialogContentText>
          <TextField
            label="Motivo do encerramento"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              onEdit();
            }}
            required
            multiline
            minRows={3}
            error={tooLong || reasonError !== null}
            helperText={
              reasonError ??
              `De ${REASON_MIN} a ${REASON_MAX} caracteres (${trimmed.length}/${REASON_MAX})`
            }
            disabled={busy}
            fullWidth
          />
          {failure && (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  disabled={busy || !valid}
                  onClick={() => onConfirm(trimmed)}
                >
                  Tentar novamente
                </Button>
              }
            >
              {failure}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={!valid || busy}
          onClick={() => onConfirm(trimmed)}
        >
          {busy ? 'Encerrando…' : 'Encerrar orientação'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
