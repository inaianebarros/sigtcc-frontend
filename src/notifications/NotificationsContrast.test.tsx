import { createTheme } from '@mui/material';
import { describe, expect, it } from 'vitest';
import { contrast, opaque } from '../test/contrast';

const WHITE: [number, number, number] = [255, 255, 255];
const MINIMUM = 4.5;

// O jsdom não resolve as variáveis CSS do MUI: as cores vêm do tema.
const { primary, error, text } = createTheme().palette;

describe('Notificações: contraste mínimo de 4,5:1 (WCAG 2.1 AA)', () => {
  it('o marcador "Não lida", na cor primária, lê-se sobre o painel branco', () => {
    expect(contrast(opaque(primary.main, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });

  it('o número do selo lê-se sobre o fundo de erro', () => {
    expect(
      contrast(opaque(error.contrastText, WHITE), opaque(error.main, WHITE)),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('a data relativa e os detalhes, em texto secundário, leem-se sobre o painel branco', () => {
    expect(
      contrast(opaque(text.secondary, WHITE), WHITE),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('a mensagem, em texto primário, lê-se sobre o painel branco', () => {
    expect(contrast(opaque(text.primary, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });

  it('os botões de texto, na cor primária, leem-se sobre o painel branco', () => {
    expect(contrast(opaque(primary.main, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });
});
