import { useState } from 'react';

interface DialogSlot {
  open: boolean;
  /** Muda a cada abertura: quem usa a põe na `key` do diálogo, para o formulário recomeçar. */
  openCount: number;
}

/**
 * O estado de um diálogo que abre e fecha várias vezes. `slot` é `null` com o diálogo desmontado;
 * `hide` só o fecha, para a animação de saída rodar, e `unmount` o tira quando ela termina.
 */
export function useDialogSlot() {
  const [slot, setSlot] = useState<DialogSlot | null>(null);
  return {
    slot,
    show: () =>
      setSlot((current) => ({
        open: true,
        openCount: (current?.openCount ?? 0) + 1,
      })),
    hide: () => setSlot((current) => current && { ...current, open: false }),
    unmount: () => setSlot(null),
  };
}
