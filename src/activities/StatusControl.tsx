import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { ActivityStatus } from '../services/activityService';

export type StudentSettableStatus = 'pending' | 'in_progress';

interface StatusControlProps {
  status: ActivityStatus;
  /** Um pedido em curso: os dois botões esperam por ele. */
  busy: boolean;
  onChange: (status: StudentSettableStatus) => void;
}

/**
 * O controle do aluno entre Pendente e Em andamento (RF28): o clique muda o status na hora, sem
 * botão de salvar. Num grupo exclusivo, clicar no que já está marcado entrega `null`, e isso não
 * faz nada.
 */
export function StatusControl({ status, busy, onChange }: StatusControlProps) {
  return (
    <ToggleButtonGroup
      exclusive
      color="primary"
      size="small"
      aria-label="Status da atividade"
      value={status}
      disabled={busy}
      onChange={(_, next: StudentSettableStatus | null) => {
        if (next !== null) onChange(next);
      }}
    >
      <ToggleButton value="pending">Pendente</ToggleButton>
      <ToggleButton value="in_progress">Em andamento</ToggleButton>
    </ToggleButtonGroup>
  );
}
