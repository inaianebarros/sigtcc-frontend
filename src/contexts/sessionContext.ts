import { createContext } from 'react';

export interface SessionContextValue {
  isAuthenticated: boolean;
  expiredMessage: string | null;
  startSession: (accessToken: string) => void;
  endSession: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
