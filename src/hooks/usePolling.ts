import { useEffect, useEffectEvent } from 'react';

interface PollingOptions {
  intervalMs: number;
  /** Desabilitado, nada é consultado: quem não entrou, e o administrador (ADR 0003). */
  enabled: boolean;
}

/**
 * Chama `poll` ao começar e a cada `intervalMs` enquanto a aba está visível (ADR 0003, RNF04). Com
 * a aba oculta o ciclo pausa, e ao voltar ela consulta na hora e retoma. A consulta mais recente
 * é sempre a usada, sem reiniciar o ciclo, e o ciclo para ao desabilitar ou desmontar.
 */
export function usePolling(
  poll: () => void,
  { intervalMs, enabled }: PollingOptions,
) {
  const latestPoll = useEffectEvent(poll);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      latestPoll();
      timer = setInterval(latestPoll, intervalMs);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
