import { Chip, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { contrast, opaque } from '../test/contrast';
import type { Advisee } from '../services/adviseeService';
import { AdviseeActionsMenu } from './AdviseeActionsMenu';
import { AdviseeCard } from './AdviseeCard';
import { theme } from '../theme';

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const MINIMUM = 4.5;

// O jsdom não resolve as variáveis CSS do MUI: as cores vêm do tema.

function colorsOf(element: HTMLElement, surface: Rgb) {
  const style = getComputedStyle(element);
  const background = opaque(style.backgroundColor, surface) as Rgb;
  return { text: opaque(style.color, background), background };
}

describe('Orientandos: contraste mínimo de 4,5:1 (WCAG 2.1 AA)', () => {
  it.each([
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

  describe('destaque da contagem "Em revisão" (RN21)', () => {
    const advisee = (inReview: number): Advisee => ({
      advisingId: 1,
      student: {
        id: 101,
        fullName: 'Ana Souza',
        course: { id: 10, name: 'Ciência da Computação' },
      },
      startedAt: '2026-11-02T14:30:00Z',
      thesisTopic: null,
      activities: { pending: 0, inProgress: 2, inReview, completed: 0 },
    });
    const chipOf = (label: string) => screen.getByText(label).parentElement!;
    const renderCard = (inReview: number) =>
      render(
        <ThemeProvider theme={theme}>
          <AdviseeCard advisee={advisee(inReview)} />
        </ThemeProvider>,
      );

    it('com contagem acima de zero, só a "Em revisão" ganha o fundo suave e lê-se a 4,5:1', () => {
      renderCard(3);

      const filled = colorsOf(chipOf('Em revisão: 3'), WHITE);

      expect(
        getComputedStyle(chipOf('Em revisão: 3')).backgroundColor,
      ).not.toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(chipOf('Em andamento: 2')).backgroundColor).toBe(
        'rgba(0, 0, 0, 0)',
      );
      expect(contrast(filled.text, filled.background)).toBeGreaterThanOrEqual(
        MINIMUM,
      );
    });

    it('as contagens zeradas ficam neutras e ainda se leem a 4,5:1', () => {
      renderCard(0);

      const zero = colorsOf(chipOf('Pendentes: 0'), WHITE);

      expect(getComputedStyle(chipOf('Em revisão: 0')).backgroundColor).toBe(
        'rgba(0, 0, 0, 0)',
      );
      expect(contrast(zero.text, zero.background)).toBeGreaterThanOrEqual(
        MINIMUM,
      );
    });
  });
});
