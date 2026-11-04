import { Navigate, Outlet } from 'react-router-dom';
import { LoadingIndicator } from './LoadingIndicator';
import { useSession } from '../hooks/useSession';
import { homePathFor, paths } from '../navigation/paths';
import type { UserType } from '../types/session';

export function RequireAuth({ userType }: { userType: UserType }) {
  const { status, user } = useSession();

  if (status === 'loading') {
    return <LoadingIndicator />;
  }
  if (status === 'anonymous' || !user) {
    return <Navigate to={paths.login} replace />;
  }
  if (user.type !== userType) {
    return <Navigate to={homePathFor(user.type)} replace />;
  }
  return <Outlet />;
}
