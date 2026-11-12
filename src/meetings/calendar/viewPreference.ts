/** As visões do calendário de reuniões (RF19). */
export const CALENDAR_VIEWS = ['day', 'week', 'month'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const DEFAULT_VIEW: CalendarView = 'month';

/** As visões oferecidas; uma escolha salva fora delas volta ao padrão. */
export const AVAILABLE_VIEWS: readonly CalendarView[] = CALENDAR_VIEWS;

const storageKey = (userId: number) => `sigtcc:reunioes:visao:${userId}`;

/**
 * A visão salva no navegador para o usuário (RN46). Nada é pedido ao usuário: o armazenamento pode
 * estar bloqueado ou vazio, e então vale o padrão, o Mês.
 */
export function loadViewPreference(userId: number): CalendarView {
  try {
    const saved = window.localStorage.getItem(storageKey(userId));
    return AVAILABLE_VIEWS.find((view) => view === saved) ?? DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

export function saveViewPreference(userId: number, view: CalendarView): void {
  try {
    window.localStorage.setItem(storageKey(userId), view);
  } catch {
    // Sem armazenamento a preferência só não é lembrada.
  }
}
