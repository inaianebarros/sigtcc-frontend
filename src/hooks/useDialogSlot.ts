import { useState } from 'react';

interface DialogSlot<T> {
  open: boolean;
  /** Muda a cada abertura: quem usa a põe na `key` do diálogo, para o formulário recomeçar. */
  openCount: number;
  /** O que o diálogo precisa saber de quem o abriu, como o orientando escolhido. */
  payload: T;
}

/**
 * O estado de um diálogo que abre e fecha várias vezes. `slot` é `null` com o diálogo desmontado;
 * `hide` só o fecha, para a animação de saída rodar, e `unmount` o tira quando ela termina.
 */
export function useDialogSlot<T = undefined>() {
  const [slot, setSlot] = useState<DialogSlot<T> | null>(null);
  return {
    slot,
    show: (...args: undefined extends T ? [payload?: T] : [payload: T]) =>
      setSlot((current) => ({
        open: true,
        openCount: (current?.openCount ?? 0) + 1,
        payload: args[0] as T,
      })),
    hide: () => setSlot((current) => current && { ...current, open: false }),
    unmount: () => setSlot(null),
  };
}
