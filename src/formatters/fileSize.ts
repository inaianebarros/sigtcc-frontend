const UNITS = ['KB', 'MB', 'GB'] as const;
const STEP = 1024;

const oneDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Por exemplo, "512 B", "1,5 KB" ou "3,0 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'tamanho indisponível';
  if (bytes < STEP) return `${bytes} B`;
  let value = bytes / STEP;
  let unit = 0;
  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP;
    unit += 1;
  }
  return `${oneDecimal.format(value)} ${UNITS[unit]}`;
}
