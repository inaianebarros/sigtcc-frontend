import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  fetchCurrentUser,
  login,
  logout,
  restoreSession,
} from '../services/authService';
import { setSessionExpiredHandler } from '../services/httpClient';
import type { SessionUser } from '../types/session';
import { SessionContext } from './sessionContext';
import type { SessionStatus } from './sessionContext';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

  // Cada sessão iniciada ou encerrada abre uma nova geração: a releitura de uma sessão que já
  // acabou não pode sobrescrever o usuário da sessão seguinte.
  const generation = useRef(0);
  const inFlight = useRef<{
    generation: number;
    promise: Promise<void>;
  } | null>(null);

  const startSession = useCallback((sessionUser: SessionUser) => {
    generation.current += 1;
    setUser(sessionUser);
    setExpiredMessage(null);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    generation.current += 1;
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

  const refreshUser = useCallback((): Promise<void> => {
    const current = generation.current;
    if (inFlight.current?.generation === current)
      return inFlight.current.promise;
    const promise = (async () => {
      try {
        const fresh = await fetchCurrentUser();
        if (generation.current === current) setUser(fresh);
      } catch {
        // a falha na releitura mantém o estado anterior; a sessão só cai pelo fluxo de renovação
      } finally {
        if (inFlight.current?.generation === current) inFlight.current = null;
      }
    })();
    inFlight.current = { generation: current, promise };
    return promise;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      startSession(await login(email, password));
      void refreshUser();
    },
    [startSession, refreshUser],
  );

  useEffect(() => {
    if (status !== 'authenticated') return;
    const onFocus = () => void refreshUser();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshUser();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [status, refreshUser]);

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
    () => ({ status, user, expiredMessage, signIn, signOut, refreshUser }),
    [status, user, expiredMessage, signIn, signOut, refreshUser],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
