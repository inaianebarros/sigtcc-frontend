import { Chip, ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { contrast, opaque } from '../test/contrast';
import { AdviseeActionsMenu } from './AdviseeActionsMenu';

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

describe('Orientandos: contraste mínimo de 4,5:1 (WCAG 2.1 AA)', () => {
  it.each([
    ['Ativa', 'success'],
    ['Pendentes: 1', 'default'],
    ['Em andamento: 2', 'primary'],
    ['Em revisão: 3', 'secondary'],
    ['Concluídas: 4', 'success'],
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

  it('o item "Encerrar orientação" do menu lê-se sobre o fundo do menu', async () => {
    render(
      <ThemeProvider theme={theme}>
        <AdviseeActionsMenu studentName="Ana Souza" onEnd={() => undefined} />
      </ThemeProvider>,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Mais ações de Ana Souza' }),
    );
    const item = await screen.findByRole('menuitem', {
      name: 'Encerrar orientação',
    });
    const { text, background } = colorsOf(item, WHITE);

    expect(contrast(text, background)).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o botão "⋯" lê-se sobre o cartão branco', () => {
    render(
      <ThemeProvider theme={theme}>
        <AdviseeActionsMenu studentName="Ana Souza" onEnd={() => undefined} />
      </ThemeProvider>,
    );
    const { text, background } = colorsOf(
      screen.getByRole('button', { name: 'Mais ações de Ana Souza' }),
      WHITE,
    );

    expect(contrast(text, background)).toBeGreaterThanOrEqual(MINIMUM);
  });
});
