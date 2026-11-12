/** Os valores do formulário de solicitação que um clique no calendário preenche (RF60). */
export interface SlotPrefill {
  /** AAAA-MM-DD. */
  date: string;
  /** HH:MM do início; vazio no Mês, onde só a data é preenchida. */
  time: string;
  /** HH:MM do término sugerido; vazio no Mês. */
  endTime: string;
}

const SANTAREM_OFFSET_MS = 3 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const LAST_MINUTE = '23:59';

/** A data (AAAA-MM-DD) de hoje no horário de Santarém, que fica em UTC-3 o ano inteiro. */
function todayInSantarem(now: Date): string {
  return new Date(now.getTime() - SANTAREM_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * O que um clique no calendário preenche no formulário de solicitação (RF60), ou `null` quando o
 * clique não faz nada.
 *
 * `dateStr` é o texto que o calendário dá ao clique: só a data (AAAA-MM-DD) quando o clique foi num
 * dia do Mês, e data, hora e fuso (AAAA-MM-DDTHH:MM:SS-03:00) quando foi numa faixa de horário do
 * Dia ou da Semana.
 *
 * - Num dia, vale o próprio dia ou um posterior: o dia de hoje ainda tem horários futuros, e o
 *   formulário valida o horário que o usuário escolher. Início e término ficam em branco.
 * - Numa faixa, só vale se ela ainda não começou; o início é o começo da faixa e o término sugerido
 *   vem uma hora depois, sem passar da meia-noite, porque a reunião termina no mesmo dia (RN45).
 */
export function prefillFromClick(
  dateStr: string,
  now: Date = new Date(),
): SlotPrefill | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (dateOnly) {
    return dateStr >= todayInSantarem(now)
      ? { date: dateStr, time: '', endTime: '' }
      : null;
  }
  // Um instante sem fuso é lido no horário de Santarém, e não no do navegador.
  const zoned = /(Z|[+-]\d{2}:\d{2})$/i.test(dateStr)
    ? dateStr
    : `${dateStr}-03:00`;
  const start = new Date(zoned);
  if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime()) {
    return null;
  }
  const date = dateStr.slice(0, 10);
  const time = dateStr.slice(11, 16);
  const end = new Date(start.getTime() + HOUR_MS);
  const sameDay =
    new Date(end.getTime() - SANTAREM_OFFSET_MS).toISOString().slice(0, 10) ===
    date;
  const endTime = sameDay
    ? new Date(end.getTime() - SANTAREM_OFFSET_MS).toISOString().slice(11, 16)
    : LAST_MINUTE;
  return { date, time, endTime };
}
