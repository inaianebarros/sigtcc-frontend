import { ConfirmDialog } from '../components/ConfirmDialog';

interface RequestAdvisingDialogProps {
  open: boolean;
  advisorName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** A confirmação de solicitar orientação (RNF21), que não pode ser enviada duas vezes. */
export function RequestAdvisingDialog({
  open,
  advisorName,
  busy,
  onCancel,
  onConfirm,
}: RequestAdvisingDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={`Solicitar orientação ao professor ${advisorName}?`}
      message="O professor tem 7 dias para responder. Enquanto a solicitação estiver pendente, você não poderá enviar outra."
      confirmLabel="Solicitar"
      confirmColor="primary"
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
