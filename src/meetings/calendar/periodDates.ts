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
