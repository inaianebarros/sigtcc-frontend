import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contrast, opaque } from '../test/contrast';
import { NO_DELIVERY_REASON, StatusAndDelivery } from './StatusAndDelivery';

const WHITE: [number, number, number] = [255, 255, 255];
const MINIMUM = 4.5;

function renderSection(hasDelivery: boolean) {
  render(
    <ThemeProvider theme={createTheme()}>
      <StatusAndDelivery
        status="pending"
        statusBusy={false}
        hasDelivery={hasDelivery}
        onChangeStatus={() => {}}
        onDeliver={() => {}}
        onSendForReview={() => {}}
      />
    </ThemeProvider>,
  );
}

describe('Entrega e status: contraste mínimo de 4,5:1 (WCAG 2.1 AA)', () => {
  it('o motivo do botão desabilitado, em texto secundário, lê-se sobre o fundo', () => {
    renderSection(false);

    const reason = screen.getByText(NO_DELIVERY_REASON);

    expect(
      contrast(opaque(getComputedStyle(reason).color, WHITE), WHITE),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o texto do botão Enviar para revisão lê-se sobre a cor do botão (tema)', () => {
    // O jsdom não resolve as variáveis CSS do botão do MUI: as cores vêm do tema.
    const { primary } = createTheme().palette;

    expect(
      contrast(
        opaque(primary.contrastText, WHITE),
        opaque(primary.main, WHITE),
      ),
    ).toBeGreaterThanOrEqual(MINIMUM);
  });

  it('o texto de erro de cada arquivo (cor de erro do tema) lê-se sobre o fundo do diálogo', () => {
    const { error } = createTheme().palette;

    expect(contrast(opaque(error.main, WHITE), WHITE)).toBeGreaterThanOrEqual(
      MINIMUM,
    );
  });
});
