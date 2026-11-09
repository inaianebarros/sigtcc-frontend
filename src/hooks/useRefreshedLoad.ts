import { useEffect, useRef, useState } from 'react';
import { useLoad } from './useLoad';
import type { LoadState } from './useLoad';

/** Um foco e uma aba que volta a ficar visível chegam quase juntos: valem uma leitura só. */
const RELOAD_DEBOUNCE_MS = 1000;

/**
 * Uma leitura que se refaz quando a pessoa volta para a aba, sem polling (ADR 0003). Os dados já
 * na tela ficam enquanto a nova leitura corre ou se ela falha: só o primeiro carregamento mostra
 * o esqueleto ou o erro. `retry` refaz a leitura depois de uma falha.
 */
export function useRefreshedLoad<T>(load: () => Promise<T>): {
  state: LoadState<T>;
  retry: () => void;
} {
  const [reads, setReads] = useState(0);
  const result = useLoad(load, reads);
  const [kept, setKept] = useState<T | null>(null);
  if (result.status === 'ready' && result.data !== kept) {
    setKept(result.data);
  }
  const lastReload = useRef(0);

  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastReload.current < RELOAD_DEBOUNCE_MS) return;
      lastReload.current = now;
      setReads((count) => count + 1);
    };
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
    return () => {
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', reload);
    };
  }, []);

  const keepsTheScreen = result.status !== 'ready' && kept !== null;
  const state: LoadState<T> = keepsTheScreen
    ? { status: 'ready', data: kept }
    : result;
  return { state, retry: () => setReads((count) => count + 1) };
}
