import { Chip } from '@mui/material';

/** O selo de disponibilidade do professor (RN26): verde quando disponível, neutro quando não. */
export function AvailabilityBadge({ isAvailable }: { isAvailable: boolean }) {
  return (
    <Chip
      label={isAvailable ? 'Disponível para orientar' : 'Indisponível'}
      size="small"
      color={isAvailable ? 'success' : 'default'}
      variant="outlined"
      sx={{ flexShrink: 0, alignSelf: 'flex-start' }}
    />
  );
}
