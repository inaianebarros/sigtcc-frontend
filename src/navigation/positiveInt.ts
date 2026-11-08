/**
 * Um inteiro de 1 em diante lido de um texto da URL. Qualquer outra coisa, como "abc", "0", "1.5"
 * ou "-2", não é um número válido e vira `null`.
 */
export function positiveIntFrom(
  value: string | null | undefined,
): number | null {
  return value !== null && value !== undefined && /^[1-9]\d*$/.test(value)
    ? Number(value)
    : null;
}
