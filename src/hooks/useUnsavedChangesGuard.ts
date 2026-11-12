import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import type { Blocker, Location } from 'react-router-dom';
import { PAGE_PARAM } from './useUrlPage';

/**
 * O endereço de uma tela sem a página de uma lista: trocar de página dentro da tela, como a lista de
 * propostas do perfil, não é sair dela e não pede para descartar o formulário.
 */
function screenOf({ pathname, search }: Location): string {
  const params = new URLSearchParams(search);
  params.delete(PAGE_PARAM);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}

/**
 * Impede sair da tela com alterações pendentes (RNF28): navegação interna e botão Voltar passam
 * pelo bloqueio do roteador, e fechar ou recarregar a aba pede confirmação ao navegador.
 */
export function useUnsavedChangesGuard(hasPendingChanges: boolean): Blocker {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasPendingChanges && screenOf(currentLocation) !== screenOf(nextLocation),
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
