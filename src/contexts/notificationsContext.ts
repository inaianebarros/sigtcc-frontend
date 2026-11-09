import { createContext } from 'react';

export interface NotificationsContextValue {
  /** O total de não lidas, o do selo do sino: o último que a consulta trouxe, ajustado na hora pelo que a pessoa lê. */
  count: number;
  setCount: (update: (current: number) => number) => void;
}

export const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);
