import { createTheme } from '@mui/material';
import { describe, expect, it } from 'vitest';
import { contrast, opaque } from '../test/contrast';

const WHITE: [number, number, number] = [255, 255, 255];
const MINIMUM = 4.5;

// O jsdom não resolve as variáveis CSS do MUI: as cores vêm do tema.
const { primary, text, error } = createTheme().palette;

describe('Comentários: contraste mínimo de 4,5:1 (WCAG 2.1 AA)', () => {
  it('o texto do botão Comentar lê-se sobre a cor primária', () => {
    expect(
      contrast(
        opaque(primary.contrastText, WHITE),
        opaque(primary.main, WHITE),
      ),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('a etiqueta "Você", na cor primária, lê-se sobre o cartão branco', () => {
    expect(contrast(opaque(primary.main, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });

  it('a data, em texto secundário, lê-se sobre o cartão branco', () => {
    expect(
      contrast(opaque(text.secondary, WHITE), WHITE),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o erro do campo lê-se sobre o fundo', () => {
    expect(contrast(opaque(error.main, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });
});
