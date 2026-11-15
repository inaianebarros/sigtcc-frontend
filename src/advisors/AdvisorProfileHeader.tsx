import { Box, Stack, Typography } from '@mui/material';
import { AvailabilityBadge } from './AvailabilityBadge';

interface AdvisorProfileHeaderProps {
  fullName: string;
  institute: string;
  isAvailable: boolean;
}

/** O nome do professor com o selo de disponibilidade à direita, alinhado a ele, e o instituto abaixo. */
export function AdvisorProfileHeader({
  fullName,
  institute,
  isAvailable,
}: AdvisorProfileHeaderProps) {
  return (
    <Stack spacing={0.5}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {fullName}
        </Typography>
        {/* Tem a altura da primeira linha do nome, para o selo ficar centrado nela. */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            height: '2.625rem',
          }}
        >
          <AvailabilityBadge isAvailable={isAvailable} />
        </Box>
      </Stack>
      <Typography color="text.secondary">{institute}</Typography>
    </Stack>
  );
}
