import { useEffect, useState } from 'react';

/** O valor só muda depois de `delayMs` sem novas mudanças (por exemplo, a pausa na digitação). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
