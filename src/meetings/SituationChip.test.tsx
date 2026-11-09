import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MEETING_SITUATIONS } from '../services/meetingService';
import { SituationChip } from './SituationChip';
import { SITUATIONS } from './situationDisplay';

/** O canal de uma cor `#rrggbb` ou `rgba(r, g, b, a)`, misturada ao fundo quando é translúcida. */
function opaque(color: string, background: [number, number, number]) {
  if (color.startsWith('#')) {
    const hex =
      color.length === 4
        ? [...color.slice(1)].map((d) => d + d).join('')
        : color.slice(1);
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number) as [
    number,
    number,
    number,
    number?,
  ];
  return [r, g, b].map((channel, i) =>
    Math.round(channel * a + background[i]! * (1 - a)),
  );
}

function luminance([r, g, b]: number[]): number {
  const channels = [r!, g!, b!].map((value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(first: number[], second: number[]): number {
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (light! + 0.05) / (dark! + 0.05);
}

describe('a etiqueta da situação da reunião', () => {
  it.each(MEETING_SITUATIONS)(
    'tem texto e ícone, e o texto %s tem contraste de pelo menos 4,5:1 com o fundo',
    (situation) => {
      const theme = createTheme();
      render(
        <ThemeProvider theme={theme}>
          <SituationChip situation={situation} />
        </ThemeProvider>,
      );

      const label = screen.getByText(SITUATIONS[situation].label);
      const chip = label.closest('.MuiChip-root') as HTMLElement;
      expect(chip.querySelector('svg')).not.toBeNull();
      const white: [number, number, number] = [255, 255, 255];
      const text = opaque(getComputedStyle(chip).color, white);
      expect(contrast(text, white)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
