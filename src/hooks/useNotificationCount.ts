import { useContext } from 'react';
import { NotificationsContext } from '../contexts/notificationsContext';
import type { NotificationsContextValue } from '../contexts/notificationsContext';

export function useNotificationCount(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      'useNotificationCount deve ser usado dentro de NotificationsProvider',
    );
  }
  return context;
}
