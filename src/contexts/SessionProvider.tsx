import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { login, logout, restoreSession } from '../services/authService';
import { setSessionExpiredHandler } from '../services/httpClient';
import type { SessionUser } from '../types/session';
import { SessionContext } from './sessionContext';
import type { SessionStatus } from './sessionContext';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

  const startSession = useCallback((sessionUser: SessionUser) => {
    setUser(sessionUser);
    setExpiredMessage(null);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    const removeExpiredHandler = setSessionExpiredHandler((message) => {
      clearSession();
      setExpiredMessage(message);
    });
    let active = true;
    void restoreSession().then((restored) => {
      if (!active) return;
      if (restored) startSession(restored);
      else clearSession();
    });
    return () => {
      active = false;
      removeExpiredHandler();
    };
  }, [startSession, clearSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      startSession(await login(email, password));
    },
    [startSession],
  );

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // the local session ends even when the server could not be reached
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ status, user, expiredMessage, signIn, signOut }),
    [status, user, expiredMessage, signIn, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
