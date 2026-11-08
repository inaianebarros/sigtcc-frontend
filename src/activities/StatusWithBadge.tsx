import { Chip, Stack } from '@mui/material';
import type { ActivityStatus } from '../services/activityService';
import { STATUS_LABELS } from './activityStatus';

/**
 * A situação da atividade e, ao lado dela, o selo "Atrasada" (RN24). O selo vem do servidor e é
 * texto, não só cor; a situação original continua visível.
 */
export function StatusWithBadge({
  status,
  overdue,
}: {
  status: ActivityStatus;
  overdue: boolean;
}) {
  return (
    <Stack
      direction="row"
      useFlexGap
      sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
    >
      <span>{STATUS_LABELS[status]}</span>
      {overdue && <Chip label="Atrasada" color="error" size="small" />}
    </Stack>
  );
}
