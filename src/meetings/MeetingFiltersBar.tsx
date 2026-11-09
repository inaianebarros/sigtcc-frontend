import { MenuItem, Stack, TextField } from '@mui/material';
import { MEETING_SITUATIONS } from '../services/meetingService';
import type { MeetingSituation } from '../services/meetingService';
import { AdviseeSearchField } from './AdviseeSearchField';
import { SITUATIONS } from './situationDisplay';

const ALL = 'all';

interface MeetingFiltersBarProps {
  situation: MeetingSituation | null;
  dateFrom: string | null;
  dateTo: string | null;
  rangeError: string | null;
  /** O filtro de aluno só aparece para o professor. */
  student: { id: number; name: string } | null | undefined;
  onSituation: (value: MeetingSituation | null) => void;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  onStudent: (id: number | null) => void;
}

export function MeetingFiltersBar({
  situation,
  dateFrom,
  dateTo,
  rangeError,
  student,
  onSituation,
  onDateFrom,
  onDateTo,
  onStudent,
}: MeetingFiltersBarProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      useFlexGap
      sx={{ gap: 2, alignItems: { md: 'flex-start' }, flexWrap: 'wrap' }}
    >
      <TextField
        select
        label="Situação"
        value={situation ?? ALL}
        onChange={(event) =>
          onSituation(
            event.target.value === ALL
              ? null
              : (event.target.value as MeetingSituation),
          )
        }
        sx={{ minWidth: 180 }}
      >
        <MenuItem value={ALL}>Todas</MenuItem>
        {MEETING_SITUATIONS.map((value) => (
          <MenuItem key={value} value={value}>
            {SITUATIONS[value].label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="De"
        type="date"
        value={dateFrom ?? ''}
        onChange={(event) => onDateFrom(event.target.value)}
        error={rangeError !== null}
        helperText={rangeError}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label="Até"
        type="date"
        value={dateTo ?? ''}
        onChange={(event) => onDateTo(event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      {student !== undefined && (
        <Stack sx={{ minWidth: { md: 280 }, flex: { md: 1 } }}>
          <AdviseeSearchField
            label="Aluno"
            value={student}
            onChange={(choice) => onStudent(choice ? choice.id : null)}
          />
        </Stack>
      )}
    </Stack>
  );
}
