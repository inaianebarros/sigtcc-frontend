import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { RecordType } from '../services/advisingRecordsService';

/** O azul padrão do botão marcado, sobre o fundo claro dele, fica abaixo de 4,5:1 (RNF23). */
const SELECTED_SX = { '&.Mui-selected': { color: 'primary.dark' } } as const;

interface RecordTypeFilterProps {
  /** `null` é "Todos". */
  value: RecordType | null;
  onChange: (type: RecordType | null) => void;
}

/**
 * O filtro "Tipo de registro" (Todos, Reuniões, Atividades). Num grupo exclusivo, clicar no que já
 * está marcado entrega `null`, e isso não faz nada: sempre há um tipo escolhido.
 */
export function RecordTypeFilter({ value, onChange }: RecordTypeFilterProps) {
  const current = value ?? 'all';
  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      color="primary"
      size="small"
      aria-label="Tipo de registro"
      value={current}
      onChange={(_, next: RecordType | 'all' | null) => {
        if (next === null) return;
        onChange(next === 'all' ? null : next);
      }}
    >
      <ToggleButton value="all" sx={SELECTED_SX}>
        Todos
      </ToggleButton>
      <ToggleButton value="meeting" sx={SELECTED_SX}>
        Reuniões
      </ToggleButton>
      <ToggleButton value="activity" sx={SELECTED_SX}>
        Atividades
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
