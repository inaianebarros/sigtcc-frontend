import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling';

const INTERVAL = 30_000;

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
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
});
