import { ACTIVITY_STATUSES } from '../services/activityService';
import type { ActivityStatus } from '../services/activityService';
import { STATUS_LABELS } from './activityStatus';
import { FilterSelect } from './FilterSelect';

interface StatusOption {
  id: ActivityStatus;
  name: string;
}

/** As quatro situações. "Atrasada" não entra: é uma indicação calculada (RN24), não um status. */
const STATUS_OPTIONS: StatusOption[] = ACTIVITY_STATUSES.map((status) => ({
  id: status,
  name: STATUS_LABELS[status],
}));

interface StatusFilterFieldProps {
  /** A situação filtrada, ou `null` para Todas. */
  value: ActivityStatus | null;
  onChange: (status: ActivityStatus | null) => void;
}

/** O filtro "Situação": o mesmo seletor do filtro de aluno, sobre a lista fixa de situações. */
export function StatusFilterField({ value, onChange }: StatusFilterFieldProps) {
  return (
    <FilterSelect
      label="Situação"
      allLabel="Todas"
      value={STATUS_OPTIONS.find((option) => option.id === value) ?? null}
      options={STATUS_OPTIONS}
      onChange={(option) => onChange(option?.id ?? null)}
      noOptionsText="Nenhuma situação encontrada"
    />
  );
}
