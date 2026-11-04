import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { homePathFor, paths } from '../navigation/paths';
import type { UserType } from '../types/session';

export function RequireAuth({ userType }: { userType: UserType }) {
  const { status, user } = useSession();

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  }
  if (status === 'anonymous' || !user) {
    return <Navigate to={paths.login} replace />;
  }
  if (user.type !== userType) {
    return <Navigate to={homePathFor(user.type)} replace />;
  }
  return <Outlet />;
}
