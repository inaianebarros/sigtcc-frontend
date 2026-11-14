import { Chip, ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contrast, opaque } from '../test/contrast';
import { RecordTypeFilter } from './RecordTypeFilter';

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const MINIMUM = 4.5;

// O jsdom não resolve as variáveis CSS do MUI: as cores vêm do tema.
const theme = createTheme();

function colorsOf(element: HTMLElement, surface: Rgb) {
  const style = getComputedStyle(element);
  const background = opaque(style.backgroundColor, surface) as Rgb;
  return { text: opaque(style.color, background), background };
}

describe('Relatório da orientação: contraste mínimo de 4,5:1 (WCAG 2.1 AA)', () => {
  it.each([
    ['Reunião', 'primary'],
    ['Atividade', 'success'],
    ['Encerrada', 'success'],
  ] as const)('o chip "%s" lê-se sobre o cartão branco', (label, color) => {
    render(
      <ThemeProvider theme={theme}>
        <Chip label={label} color={color} size="small" variant="outlined" />
      </ThemeProvider>,
    );
    const { text, background } = colorsOf(
      screen.getByText(label).parentElement!,
      WHITE,
    );

    expect(contrast(text, background)).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o contador "N registros" lê-se sobre o próprio fundo', () => {
    render(
      <ThemeProvider theme={theme}>
        <Chip label="12 registros" size="small" />
      </ThemeProvider>,
    );
    const { text, background } = colorsOf(
      screen.getByText('12 registros').parentElement!,
      WHITE,
    );

    expect(contrast(text, background)).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o filtro lê-se marcado e desmarcado', () => {
    render(
      <ThemeProvider theme={theme}>
        <RecordTypeFilter value={null} onChange={() => undefined} />
      </ThemeProvider>,
    );
    const selected = colorsOf(
      screen.getByRole('button', { name: 'Todos' }),
      WHITE,
    );
    const idle = colorsOf(
      screen.getByRole('button', { name: 'Reuniões' }),
      WHITE,
    );

    expect(contrast(selected.text, selected.background)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
    expect(contrast(idle.text, idle.background)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });

  it('o texto secundário (datas, descrição e rótulos) lê-se sobre o cartão branco', () => {
    expect(
      contrast(opaque(theme.palette.text.secondary, WHITE), WHITE),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });
});
