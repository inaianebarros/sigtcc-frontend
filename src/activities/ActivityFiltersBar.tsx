import { FormControlLabel, Stack, Switch } from '@mui/material';
import type { ActivityStatus } from '../services/activityService';
import { ActivitySearchField } from './ActivitySearchField';
import { StatusFilterField } from './StatusFilterField';
import { StudentFilterField } from './StudentFilterField';
import type { StudentOption } from './useStudentFilterOptions';

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
      <StatusFilterField value={status} onChange={onStatus} />
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
