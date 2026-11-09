import { formatDate } from './dateTime';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

/**
 * O tempo desde `iso`, como a central de notificações o mostra: "agora", "há 5 min", "há 3 h",
 * "há 2 dias" e, depois de uma semana, a data completa. `now` vem de fora para o teste fixar o
 * relógio.
 */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return formatDate(iso);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < SECONDS_PER_MINUTE) return 'agora';
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return `há ${minutes} min`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `há ${hours} h`;
  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days < DAYS_PER_WEEK) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return formatDate(iso);
}
