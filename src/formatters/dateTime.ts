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

/**
 * O intervalo de uma reunião (RN45), por exemplo, "2 de novembro de 2026, das 11:30 às 12:30". Se o
 * término não puder ser lido, vale só o início.
 */
export function formatDateTimeRange(startIso: string, endIso: string): string {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start) return UNAVAILABLE;
  if (!end) return formatDateTime(startIso);
  return `${dateFormat.format(start)}, das ${timeFormat.format(start)} às ${timeFormat.format(end)}`;
}

const deadlineFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

/**
 * Uma data sem hora, como o prazo de uma atividade (AAAA-MM-DD): vale o mesmo dia em qualquer
 * fuso, então ela não passa pelo horário da instituição, que a faria cair no dia anterior.
 */
export function formatDeadline(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return UNAVAILABLE;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Um dia que não existe, como 30 de fevereiro, rolaria para o mês seguinte: não é uma data.
  const exists =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return exists ? deadlineFormat.format(date) : UNAVAILABLE;
}
