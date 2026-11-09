import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from '../hooks/usePolling';
import { useSession } from '../hooks/useSession';
import { getUnreadCount } from '../services/notificationService';
import { NotificationsContext } from './notificationsContext';

/** O intervalo da consulta do selo (ADR 0003, RNF04: avisos em até 1 minuto). */
export const COUNT_POLLING_INTERVAL_MS = 30_000;

/**
 * O total de notificações não lidas, consultado a cada 30 s enquanto há uma sessão de aluno ou de
 * professor e a aba está visível (ADR 0003). O administrador não recebe notificações: nada é
 * consultado para ele. Uma consulta que falha não mostra erro: o último total fica e o ciclo
 * seguinte tenta de novo. Ao trocar de usuário ou sair, o total volta a zero.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const receives =
    status === 'authenticated' &&
    (user?.type === 'student' || user?.type === 'teacher');
  const [count, setCount] = useState(0);
  const userId = receives && user ? user.id : null;
  const [countOwner, setCountOwner] = useState(userId);
  if (countOwner !== userId) {
    setCountOwner(userId);
    setCount(0);
  }

  usePolling(
    () => {
      getUnreadCount().then(setCount, () => undefined);
    },
    { intervalMs: COUNT_POLLING_INTERVAL_MS, enabled: receives },
  );

  const value = useMemo(
    () => ({ count: receives ? count : 0, setCount }),
    [count, receives],
  );
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
