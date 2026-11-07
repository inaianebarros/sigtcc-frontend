import { Chip } from '@mui/material';
import type { AdvisingRequestStatus } from '../services/advisorService';
import { statusDisplay } from './requestStatusDisplay';

export function RequestStatusChip({
  status,
}: {
  status: AdvisingRequestStatus;
}) {
  const { label, icon } = statusDisplay(status);
  return <Chip variant="outlined" icon={icon} label={label} />;
}
