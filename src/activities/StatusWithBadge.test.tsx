import { createTheme } from '@mui/material';
import { describe, expect, it } from 'vitest';

/** A luminância relativa e a razão de contraste da WCAG 2.1, sobre cores em #rrggbb. */
function expand(hex: string): string {
  // O MUI escreve o branco como #fff: três dígitos viram seis.
  return /^#[0-9a-f]{3}$/i.test(hex)
    ? `#${[...hex.slice(1)].map((digit) => digit + digit).join('')}`
    : hex;
}

function luminance(color: string): number {
  const hex = expand(color);
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (light! + 0.05) / (dark! + 0.05);
}

describe('o selo Atrasada', () => {
  it('tem o contraste mínimo de 4,5:1 do WCAG 2.1 AA entre o texto e o fundo do tema', () => {
    const { main, contrastText } = createTheme().palette.error;

    expect(contrastRatio(main, contrastText)).toBeGreaterThanOrEqual(4.5);
  });
});
