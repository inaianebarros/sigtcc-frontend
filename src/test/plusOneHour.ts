/** Uma hora depois de um instante ISO com fuso, para o término padrão das reuniões dos mocks. */
export function plusOneHour(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}T)(\d{2})(.*)$/.exec(iso);
  if (!match) return iso;
  const hour = String(Math.min(Number(match[2]) + 1, 23)).padStart(2, '0');
  return `${match[1]}${hour}${match[3]}`;
}
