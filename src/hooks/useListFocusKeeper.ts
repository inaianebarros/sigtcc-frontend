import { useLayoutEffect, useRef } from 'react';
import type { FocusEvent, RefObject } from 'react';

/**
 * Mantém o foco do teclado numa lista que se relê sozinha (ADR frontend 0006). Se a releitura tira
 * da tela o elemento focado dentro de um item, como um botão que deixou de caber, o foco iria para
 * o corpo da página: ele vai para o próprio item ou, se o item saiu da lista, para `fallback`.
 *
 * Só age quando o foco foi perdido: se a pessoa o levou para fora da lista, nada se move.
 */
export function useListFocusKeeper(fallback: RefObject<HTMLElement | null>) {
  const items = useRef(new Map<number, HTMLElement>());
  const lastFocus = useRef<{ element: HTMLElement; itemId: number } | null>(
    null,
  );

  const focusItem = (itemId: number) => {
    (items.current.get(itemId) ?? fallback.current)?.focus();
  };

  useLayoutEffect(() => {
    const last = lastFocus.current;
    if (last === null || last.element.isConnected) return;
    lastFocus.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    focusItem(last.itemId);
  });

  const itemIdOf = (target: EventTarget): number | null => {
    if (!(target instanceof Node)) return null;
    for (const [itemId, element] of items.current) {
      if (element.contains(target)) return itemId;
    }
    return null;
  };

  return {
    /** O `ref` de cada item, que também recebe o foco quando o que estava focado nele some. */
    itemRef: (itemId: number) => (element: HTMLElement | null) => {
      if (element) items.current.set(itemId, element);
      else items.current.delete(itemId);
    },
    /** Leva o foco ao item ou, se ele saiu da lista, a `fallback`. */
    focusItem,
    /** Os eventos do contêiner da lista, que acompanham onde está o foco. */
    containerProps: {
      onFocus: (event: FocusEvent<HTMLElement>) => {
        const element = event.target;
        const itemId = itemIdOf(element);
        lastFocus.current =
          itemId === null || !(element instanceof HTMLElement)
            ? null
            : { element, itemId };
      },
      onBlur: (event: FocusEvent<HTMLElement>) => {
        // Só esquece quando o foco foi para outro lugar; sem destino, ele pode ter sido perdido.
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next)) {
          lastFocus.current = null;
        }
      },
    },
  };
}
