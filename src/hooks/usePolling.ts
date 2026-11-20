import { useEffect, useEffectEvent } from 'react';

/**
 * Janela em que a volta da aba e o foco da janela, que costumam chegar juntos, contam como uma
 * releitura só (ADR frontend 0006).
 */
export const RESUME_DEBOUNCE_MS = 1_000;

interface PollingOptions {
  intervalMs: number;
  /** Desabilitado, nada é consultado: quem não entrou, e o administrador (ADR 0003). */
  enabled: boolean;
  /**
   * Se consulta logo ao habilitar. Quem já leu os dados ao montar desliga, para não ler duas
   * vezes; a volta para a aba ou para a janela consulta na hora de qualquer jeito. Padrão: `true`.
   */
  pollOnStart?: boolean;
}

/**
 * Chama `poll` ao começar e a cada `intervalMs` enquanto a aba está visível (ADR 0003, RNF04). Com
 * a aba oculta o ciclo pausa. Ao voltar para a aba ou ao a janela ganhar foco com a aba visível, ele
 * consulta na hora e reinicia o ciclo; os dois avisos juntos, dentro de `RESUME_DEBOUNCE_MS`, valem
 * uma consulta só. A consulta mais recente é sempre a usada, sem reiniciar o ciclo, e o ciclo para
 * ao desabilitar ou desmontar.
 */
export function usePolling(
  poll: () => void,
  { intervalMs, enabled, pollOnStart = true }: PollingOptions,
) {
  const latestPoll = useEffectEvent(poll);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastResumedAt = -Infinity;
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const start = (pollNow: boolean) => {
      stop();
      if (pollNow) latestPoll();
      timer = setInterval(latestPoll, intervalMs);
    };
    const resume = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastResumedAt < RESUME_DEBOUNCE_MS) {
        // O outro aviso do par já consultou; só garante que o ciclo esteja rodando.
        if (timer === null) start(false);
        return;
      }
      lastResumedAt = now;
      start(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stop();
      else resume();
    };
    if (document.visibilityState !== 'hidden') start(pollOnStart);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', resume);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', resume);
    };
  }, [enabled, intervalMs, pollOnStart]);
}
