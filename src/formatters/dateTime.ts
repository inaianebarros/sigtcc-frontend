// A UFOPA fica em Santarém (UTC-3): as datas aparecem no horário da instituição, não no do navegador.
const TIME_ZONE = 'America/Santarem';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeStyle: 'short',
  timeZone: TIME_ZONE,
});

const UNAVAILABLE = 'data indisponível';

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Por exemplo, "2 de novembro de 2026". */
export function formatDate(iso: string): string {
  const date = parse(iso);
  return date ? dateFormat.format(date) : UNAVAILABLE;
}

/** Por exemplo, "2 de novembro de 2026, às 11:30". */
export function formatDateTime(iso: string): string {
  const date = parse(iso);
  return date
    ? `${dateFormat.format(date)}, às ${timeFormat.format(date)}`
    : UNAVAILABLE;
}
