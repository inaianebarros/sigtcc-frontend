import { createTheme } from '@mui/material';
import { describe, expect, it } from 'vitest';
import { contrast, opaque } from '../test/contrast';

const WHITE: [number, number, number] = [255, 255, 255];
const MINIMUM = 4.5;

// O jsdom não resolve as variáveis CSS do MUI: as cores vêm do tema.
const { primary, text, error } = createTheme().palette;

describe('Dashboard: contraste mínimo de 4,5:1 (WCAG 2.1 AA)', () => {
  it('o número comum de um indicador lê-se sobre o cartão branco', () => {
    expect(contrast(opaque(text.primary, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });

  it('o rótulo de um indicador, em texto secundário, lê-se sobre o cartão branco', () => {
    expect(
      contrast(opaque(text.secondary, WHITE), WHITE),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o número das atrasadas, na cor de erro, lê-se sobre o cartão branco', () => {
    expect(contrast(opaque(error.main, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });

  it('o botão Pesquisar orientadores lê-se sobre a cor primária', () => {
    expect(
      contrast(
        opaque(primary.contrastText, WHITE),
        opaque(primary.main, WHITE),
      ),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('os links, na cor primária, leem-se sobre o fundo branco', () => {
    expect(contrast(opaque(primary.main, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });
});
