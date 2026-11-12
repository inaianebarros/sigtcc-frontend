const DAY_MS = 24 * 60 * 60 * 1000;

/** A data (AAAA-MM-DD) de um instante ISO com fuso, como foi escrita no próprio texto. */
export function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

/** O dia anterior a uma data AAAA-MM-DD: o fim de um período do calendário é exclusivo. */
export function dayBefore(date: string): string {
  const moment = new Date(`${date}T00:00:00Z`).getTime() - DAY_MS;
  return new Date(moment).toISOString().slice(0, 10);
}

/** Por exemplo, "novembro de 2026" vira "Novembro de 2026". */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
}

const longDate = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeZone: 'UTC',
});
const weekdayAndDate = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthAndDay = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const asUtc = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * O título de um dia ou de uma semana (RF19): "Terça-feira, 10 de novembro de 2026" para o dia, e
 * para a semana "8 – 14 de novembro de 2026", ou "29 de novembro – 5 de dezembro de 2026" quando ela
 * cruza dois meses (com o ano de cada ponta se cruzar o ano).
 */
export function dayTitle(date: string): string {
  return capitalize(weekdayAndDate.format(asUtc(date)));
}

export function weekTitle(from: string, to: string): string {
  const start = asUtc(from);
  const end = asUtc(to);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${start.getUTCDate()} – ${longDate.format(end)}`;
  }
  if (sameYear) {
    return `${monthAndDay.format(start)} – ${longDate.format(end)}`;
  }
  return `${longDate.format(start)} – ${longDate.format(end)}`;
}
