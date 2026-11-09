import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MEETING_SITUATIONS } from '../services/meetingService';
import { contrast, opaque } from '../test/contrast';
import { SituationChip } from './SituationChip';
import { SITUATIONS } from './situationDisplay';

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
