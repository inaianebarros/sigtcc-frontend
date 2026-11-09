import { createTheme } from '@mui/material';
import { describe, expect, it } from 'vitest';
import { contrast, opaque } from '../test/contrast';

const WHITE: [number, number, number] = [255, 255, 255];
const MINIMUM = 4.5;

// O jsdom não resolve as variáveis CSS dos botões do MUI: as cores vêm do tema.
const { primary, error } = createTheme().palette;

describe('Revisão: contraste mínimo de 4,5:1 (WCAG 2.1 AA)', () => {
  it('o texto do botão Aceitar lê-se sobre a cor primária', () => {
    expect(
      contrast(
        opaque(primary.contrastText, WHITE),
        opaque(primary.main, WHITE),
      ),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o texto do botão Recusar atividade lê-se sobre a cor de erro', () => {
    expect(
      contrast(opaque(error.contrastText, WHITE), opaque(error.main, WHITE)),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o botão Recusar, de contorno, lê-se na cor de erro sobre o fundo', () => {
    expect(contrast(opaque(error.main, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });
});
