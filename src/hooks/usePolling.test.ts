import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESUME_DEBOUNCE_MS, usePolling } from './usePolling';

const INTERVAL = 30_000;

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function focusWindow() {
  window.dispatchEvent(new Event('focus'));
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('usePolling', () => {
  it('consulta ao começar e depois a cada intervalo, enquanto a aba está visível', () => {
    const poll = vi.fn();
    renderHook(() => usePolling(poll, { intervalMs: INTERVAL, enabled: true }));

    expect(poll).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(INTERVAL);
    });
    expect(poll).toHaveBeenCalledTimes(2);
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 2);
    });
    expect(poll).toHaveBeenCalledTimes(4);
  });

  it('não consulta antes de completar o intervalo', () => {
    const poll = vi.fn();
    renderHook(() => usePolling(poll, { intervalMs: INTERVAL, enabled: true }));

    act(() => {
      vi.advanceTimersByTime(INTERVAL - 1);
    });

    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('pausa com a aba oculta e consulta na hora ao voltar, retomando o ciclo', () => {
    const poll = vi.fn();
    renderHook(() => usePolling(poll, { intervalMs: INTERVAL, enabled: true }));
    expect(poll).toHaveBeenCalledTimes(1);

    act(() => setVisibility('hidden'));
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 5);
    });
    expect(poll).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    expect(poll).toHaveBeenCalledTimes(2);
    act(() => {
      vi.advanceTimersByTime(INTERVAL);
    });
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it('com a aba já oculta ao começar, espera ela ficar visível', () => {
    setVisibility('hidden');
    const poll = vi.fn();
    renderHook(() => usePolling(poll, { intervalMs: INTERVAL, enabled: true }));

    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3);
    });
    expect(poll).not.toHaveBeenCalled();

    act(() => setVisibility('visible'));
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('desabilitado, nunca consulta, e ao ser desabilitado para de consultar', () => {
    const poll = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => usePolling(poll, { intervalMs: INTERVAL, enabled }),
      { initialProps: { enabled: false } },
    );
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3);
    });
    expect(poll).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(poll).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3);
    });
    expect(poll).toHaveBeenCalledTimes(1);
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('ao desmontar para de consultar', () => {
    const poll = vi.fn();
    const { unmount } = renderHook(() =>
      usePolling(poll, { intervalMs: INTERVAL, enabled: true }),
    );

    unmount();
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3);
    });

    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('usa sempre a consulta mais recente, sem reiniciar o ciclo', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ poll }) => usePolling(poll, { intervalMs: INTERVAL, enabled: true }),
      { initialProps: { poll: first } },
    );

    rerender({ poll: second });
    act(() => {
      vi.advanceTimersByTime(INTERVAL);
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('sem consulta inicial, espera o intervalo, mas ao voltar para a aba consulta na hora', () => {
    const poll = vi.fn();
    renderHook(() =>
      usePolling(poll, {
        intervalMs: INTERVAL,
        enabled: true,
        pollOnStart: false,
      }),
    );
    expect(poll).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(INTERVAL);
    });
    expect(poll).toHaveBeenCalledTimes(1);

    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('ao a janela ganhar foco com a aba visível, consulta na hora e reinicia o ciclo', () => {
    const poll = vi.fn();
    renderHook(() =>
      usePolling(poll, {
        intervalMs: INTERVAL,
        enabled: true,
        pollOnStart: false,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(INTERVAL / 2);
    });
    expect(poll).not.toHaveBeenCalled();

    act(() => focusWindow());
    expect(poll).toHaveBeenCalledTimes(1);

    // O ciclo conta de novo a partir do foco.
    act(() => {
      vi.advanceTimersByTime(INTERVAL - 1);
    });
    expect(poll).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('foco da janela e volta da aba juntos valem uma consulta só, nas duas ordens', () => {
    const poll = vi.fn();
    renderHook(() =>
      usePolling(poll, {
        intervalMs: INTERVAL,
        enabled: true,
        pollOnStart: false,
      }),
    );

    act(() => setVisibility('hidden'));
    act(() => {
      setVisibility('visible');
      focusWindow();
    });
    expect(poll).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(RESUME_DEBOUNCE_MS);
    });
    act(() => setVisibility('hidden'));
    act(() => {
      focusWindow();
      setVisibility('visible');
    });
    expect(poll).toHaveBeenCalledTimes(2);

    // Pouco depois do par, ainda dentro da janela, também não repete.
    act(() => {
      vi.advanceTimersByTime(RESUME_DEBOUNCE_MS - 1);
    });
    act(() => focusWindow());
    expect(poll).toHaveBeenCalledTimes(2);

    // O ciclo segue rodando depois do par.
    act(() => {
      vi.advanceTimersByTime(INTERVAL);
    });
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it('passada a janela de 1 s, um novo foco consulta de novo', () => {
    const poll = vi.fn();
    renderHook(() =>
      usePolling(poll, {
        intervalMs: INTERVAL,
        enabled: true,
        pollOnStart: false,
      }),
    );

    act(() => focusWindow());
    act(() => {
      vi.advanceTimersByTime(RESUME_DEBOUNCE_MS);
    });
    act(() => focusWindow());

    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('foco da janela com a aba oculta não consulta nem retoma o ciclo', () => {
    const poll = vi.fn();
    renderHook(() => usePolling(poll, { intervalMs: INTERVAL, enabled: true }));
    expect(poll).toHaveBeenCalledTimes(1);

    act(() => setVisibility('hidden'));
    act(() => focusWindow());
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3);
    });

    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('desabilitado ou desmontado, o foco da janela não consulta', () => {
    const poll = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => usePolling(poll, { intervalMs: INTERVAL, enabled }),
      { initialProps: { enabled: false } },
    );
    act(() => focusWindow());
    expect(poll).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(poll).toHaveBeenCalledTimes(1);
    unmount();
    act(() => {
      vi.advanceTimersByTime(RESUME_DEBOUNCE_MS);
    });
    act(() => focusWindow());
    expect(poll).toHaveBeenCalledTimes(1);
  });
});
