import {
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { ACTIVITY_STATUSES } from '../services/activityService';
import type { ActivityStatus } from '../services/activityService';
import { STATUS_LABELS } from './activityStatus';

const ALL = 'all';

interface ActivityFiltersBarProps {
  status: ActivityStatus | null;
  overdueOnly: boolean;
  /** O nome do aluno filtrado, quando há filtro de aluno (só o professor). */
  studentName: string | null;
  onStatus: (status: ActivityStatus | null) => void;
  onOverdueOnly: (on: boolean) => void;
  onClearStudent: () => void;
}

export function ActivityFiltersBar({
  status,
  overdueOnly,
  studentName,
  onStatus,
  onOverdueOnly,
  onClearStudent,
}: ActivityFiltersBarProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      useFlexGap
      sx={{ gap: 2, alignItems: { sm: 'center' }, flexWrap: 'wrap' }}
    >
      <TextField
        select
        label="Situação"
        value={status ?? ALL}
        onChange={(event) =>
          onStatus(
            event.target.value === ALL
              ? null
              : (event.target.value as ActivityStatus),
          )
        }
        sx={{ minWidth: 200 }}
      >
        <MenuItem value={ALL}>Todas</MenuItem>
        {ACTIVITY_STATUSES.map((value) => (
          <MenuItem key={value} value={value}>
            {STATUS_LABELS[value]}
          </MenuItem>
        ))}
      </TextField>
      <FormControlLabel
        control={
          <Switch
            checked={overdueOnly}
            onChange={(event) => onOverdueOnly(event.target.checked)}
          />
        }
        label="Somente atrasadas"
      />
      {studentName !== null && (
        <Chip label={`Aluno: ${studentName}`} onDelete={onClearStudent} />
      )}
    </Stack>
  );
}
