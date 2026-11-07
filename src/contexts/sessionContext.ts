import { createContext } from 'react';
import type { SessionUser } from '../types/session';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionContextValue {
  status: SessionStatus;
  user: SessionUser | null;
  expiredMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
