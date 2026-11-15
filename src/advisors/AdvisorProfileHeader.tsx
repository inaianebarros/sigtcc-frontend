import { Avatar, Stack, Typography } from '@mui/material';
import { initialsOf } from './initialsOf';
import { AvailabilityBadge } from './AvailabilityBadge';

interface AdvisorProfileHeaderProps {
  fullName: string;
  institute: string;
  isAvailable: boolean;
}

/** A barra "Perfil do professor" com o selo à direita e, abaixo, o avatar, o nome e o instituto. */
export function AdvisorProfileHeader({
  fullName,
  institute,
  isAvailable,
}: AdvisorProfileHeaderProps) {
  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography variant="subtitle1" component="p" sx={{ fontWeight: 500 }}>
          Perfil do professor
        </Typography>
        <AvailabilityBadge isAvailable={isAvailable} />
      </Stack>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Avatar
          aria-hidden
          sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
        >
          {initialsOf(fullName)}
        </Avatar>
        <Stack sx={{ minWidth: 0 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {fullName}
          </Typography>
          <Typography color="text.secondary">{institute}</Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}
