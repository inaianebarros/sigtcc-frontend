import type { MeetingItem } from '../services/meetingService';

/**
 * Como está, na última leitura do calendário, a reunião de um diálogo aberto: igual à que foi
 * aberta, alterada, ou fora do calendário (outra data, outra situação fora dos filtros).
 */
export type MeetingFreshness = 'same' | 'changed' | 'gone';

// O que a pessoa vê da reunião e o que muda com uma ação da outra parte. As flags `can_*` ficam de
// fora: mudam também com o relógio, e o servidor recusa a ação que não cabe mais (404 ou 409).
const SHOWN_FIELDS = [
  'scheduledAt',
  'endsAt',
  'description',
  'situation',
  'notes',
  'rejectionReason',
  'cancellationReason',
] as const satisfies ReadonlyArray<keyof MeetingItem>;

/** Compara a reunião aberta num diálogo com a da última leitura (`undefined` se não veio). */
export function freshnessOf(
  opened: MeetingItem,
  latest: MeetingItem | undefined,
): MeetingFreshness {
  if (latest === undefined) return 'gone';
  return SHOWN_FIELDS.every((field) => opened[field] === latest[field])
    ? 'same'
    : 'changed';
}

export const MEETING_CHANGED_MESSAGE =
  'Esta reunião foi alterada. Confira os dados antes de continuar.';
export const MEETING_GONE_MESSAGE =
  'Esta reunião não aparece mais no calendário. Ela pode ter mudado de data ou de situação.';
