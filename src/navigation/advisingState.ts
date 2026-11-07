import type { SessionUser } from '../types/session';

export function hasActiveAdvisingOf(user: SessionUser): boolean {
  switch (user.type) {
    case 'student':
      return user.hasActiveAdvising === true;
    case 'teacher':
      return (user.activeAdviseesCount ?? 0) > 0;
    default:
      return false;
  }
}
