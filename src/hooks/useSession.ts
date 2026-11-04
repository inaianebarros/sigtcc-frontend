import { useContext } from 'react';
import { SessionContext } from '../contexts/sessionContext';
import type { SessionContextValue } from '../contexts/sessionContext';

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession deve ser usado dentro de SessionProvider');
  }
  return context;
}
