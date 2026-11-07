import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import type { Blocker } from 'react-router-dom';

/**
 * Impede sair da tela com alterações pendentes (RNF28): navegação interna e botão Voltar passam
 * pelo bloqueio do roteador, e fechar ou recarregar a aba pede confirmação ao navegador.
 */
export function useUnsavedChangesGuard(hasPendingChanges: boolean): Blocker {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasPendingChanges &&
      currentLocation.pathname + currentLocation.search !==
        nextLocation.pathname + nextLocation.search,
  );

  useEffect(() => {
    if (!hasPendingChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasPendingChanges]);

  return blocker;
}
