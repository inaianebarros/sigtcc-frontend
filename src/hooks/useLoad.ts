import { useEffect, useEffectEvent, useState } from 'react';
import { ApiError, messageForStatus } from '../services/apiError';

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

type Settled<T> = {
  key: string | number;
  state: Extract<LoadState<T>, { status: 'error' | 'ready' }>;
};

export function useLoad<T>(
  load: () => Promise<T>,
  key: string | number | null,
): LoadState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const runLoad = useEffectEvent(load);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    runLoad().then(
      (data) => {
        if (active) setSettled({ key, state: { status: 'ready', data } });
      },
      (error: unknown) => {
        if (!active) return;
        const message =
          error instanceof ApiError ? error.message : messageForStatus(0);
        setSettled({ key, state: { status: 'error', message } });
      },
    );
    return () => {
      active = false;
    };
  }, [key]);

  if (key === null) return { status: 'idle' };
  if (settled?.key !== key) return { status: 'loading' };
  return settled.state;
}
