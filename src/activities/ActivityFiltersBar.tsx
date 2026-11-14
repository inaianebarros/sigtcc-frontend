import {
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { ACTIVITY_STATUSES } from '../services/activityService';
import type { ActivityStatus } from '../services/activityService';
import { STATUS_LABELS } from './activityStatus';
import { ActivitySearchField } from './ActivitySearchField';
import { StudentFilterField } from './StudentFilterField';
import type { StudentOption } from './useStudentFilterOptions';

const ALL = 'all';

interface ActivityFiltersBarProps {
  status: ActivityStatus | null;
  overdueOnly: boolean;
  /** A busca pelo título que está na URL. */
  search: string;
  /** O aluno filtrado (só o professor); `null` é Todos. */
  student: StudentOption | null;
  /** Só o professor filtra por aluno. */
  canFilterByStudent: boolean;
  onStatus: (status: ActivityStatus | null) => void;
  onOverdueOnly: (on: boolean) => void;
  onSearch: (search: string) => void;
  onStudent: (student: StudentOption | null) => void;
}

export function ActivityFiltersBar({
  status,
  overdueOnly,
  search,
  student,
  canFilterByStudent,
  onStatus,
  onOverdueOnly,
  onSearch,
  onStudent,
}: ActivityFiltersBarProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      useFlexGap
      sx={{ gap: 2, alignItems: { sm: 'center' }, flexWrap: 'wrap' }}
    >
      <ActivitySearchField value={search} onSearch={onSearch} />
      {canFilterByStudent && (
        <StudentFilterField value={student} onChange={onStudent} />
      )}
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
    </Stack>
  );
}
