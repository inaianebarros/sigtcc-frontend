import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { setSessionExpiredHandler } from '../services/httpClient';
import { tokenStore } from '../services/tokenStore';
import { SessionContext } from './sessionContext';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(
    () => tokenStore.get() !== null,
  );
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

  const startSession = useCallback((accessToken: string) => {
    tokenStore.set(accessToken);
    setExpiredMessage(null);
    setAuthenticated(true);
  }, []);

  const endSession = useCallback(() => {
    tokenStore.clear();
    setAuthenticated(false);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler((message) => {
      setAuthenticated(false);
      setExpiredMessage(message);
    });
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, expiredMessage, startSession, endSession }),
    [isAuthenticated, expiredMessage, startSession, endSession],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
