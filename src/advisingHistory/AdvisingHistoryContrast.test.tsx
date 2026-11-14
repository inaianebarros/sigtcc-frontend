import { Alert, Chip, ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contrast, opaque } from '../test/contrast';

const WHITE: [number, number, number] = [255, 255, 255];
const MINIMUM = 4.5;

// O jsdom não resolve as variáveis CSS do MUI: as cores vêm do tema.
const theme = createTheme();
const { text } = theme.palette;

describe('Histórico de orientações: contraste mínimo de 4,5:1 (WCAG 2.1 AA)', () => {
  it('o papel e as datas, em texto secundário, leem-se sobre o cartão branco', () => {
    expect(
      contrast(opaque(text.secondary, WHITE), WHITE),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o motivo, o tema e os títulos, em texto primário, leem-se sobre o cartão branco', () => {
    expect(contrast(opaque(text.primary, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });

  it('o chip "Encerrada" lê-se sobre o cartão branco', () => {
    render(
      <ThemeProvider theme={theme}>
        <Chip
          label="Encerrada"
          color="success"
          size="small"
          variant="outlined"
        />
      </ThemeProvider>,
    );
    const style = getComputedStyle(
      screen.getByText('Encerrada').parentElement!,
    );

    expect(contrast(opaque(style.color, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });

  it('o aviso do estado vazio lê-se sobre o fundo do próprio aviso', () => {
    render(
      <ThemeProvider theme={theme}>
        <Alert severity="info">Sem orientações encerradas</Alert>
      </ThemeProvider>,
    );
    const style = getComputedStyle(screen.getByRole('alert'));

    const background = opaque(style.backgroundColor, WHITE) as [
      number,
      number,
      number,
    ];
    expect(
      contrast(opaque(style.color, background), background),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });
});
