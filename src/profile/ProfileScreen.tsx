import { Alert, Button, Stack } from '@mui/material';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useLoad } from '../hooks/useLoad';
import { listAreasOfInterest } from '../services/catalogService';
import type { AreaOfInterest } from '../services/catalogService';

interface ProfileScreenProps<TProfile> {
  loadProfile: () => Promise<TProfile>;
  /** Devolve uma mensagem quando o perfil carregado não pode ser editado. */
  problemWith?: (profile: TProfile) => string | null;
  children: (profile: TProfile, areas: AreaOfInterest[]) => ReactNode;
}

/** Carrega o perfil e as áreas, com o estado de carregamento e o erro com nova tentativa. */
export function ProfileScreen<TProfile>({
  loadProfile,
  problemWith,
  children,
}: ProfileScreenProps<TProfile>) {
  const [attempt, setAttempt] = useState(0);
  const profile = useLoad(loadProfile, `profile-${attempt}`);
  const areas = useLoad(listAreasOfInterest, `areas-${attempt}`);

  const failed =
    profile.status === 'error'
      ? profile.message
      : areas.status === 'error'
        ? areas.message
        : profile.status === 'ready'
          ? (problemWith?.(profile.data) ?? null)
          : null;
  if (failed) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 720, mx: 'auto' }}>
        <Alert severity="error">{failed}</Alert>
        <Button onClick={() => setAttempt((current) => current + 1)}>
          Tentar novamente
        </Button>
      </Stack>
    );
  }
  if (profile.status !== 'ready' || areas.status !== 'ready') {
    return <LoadingIndicator />;
  }
  return <>{children(profile.data, areas.data)}</>;
}
