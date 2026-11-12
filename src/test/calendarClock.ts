import { vi } from 'vitest';

/** "Agora" dos testes do calendário: 10 de novembro de 2026, ao meio-dia em Santarém. */
export const CALENDAR_NOW = '2026-11-10T12:00:00-03:00';

let observer: MutationObserver | null = null;

function showHiddenElements(root: ParentNode) {
  for (const element of root.querySelectorAll<HTMLElement>(
    '[style*="visibility: hidden"]',
  )) {
    element.style.visibility = 'visible';
  }
}

/**
 * Prepara um teste que renderiza o calendário de reuniões:
 *
 * - congela só o relógio (`Date`), sem tocar nos temporizadores, para o calendário abrir sempre em
 *   novembro de 2026 e os testes não dependerem do dia em que rodam;
 * - mostra os eventos: o FullCalendar os esconde (`visibility: hidden`) até medir o layout, o que
 *   o jsdom não faz, e um elemento escondido some das consultas por papel e por nome acessível.
 *
 * Quem chama desfaz com `teardownCalendarTest()`.
 */
export function setupCalendarTest() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(CALENDAR_NOW));
  observer?.disconnect();
  observer = new MutationObserver(() => {
    if (typeof document !== 'undefined') showHiddenElements(document.body);
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style'],
  });
}

export function teardownCalendarTest() {
  observer?.disconnect();
  observer = null;
  vi.useRealTimers();
}
