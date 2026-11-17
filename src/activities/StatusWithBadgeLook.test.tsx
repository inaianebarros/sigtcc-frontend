import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { theme } from '../theme';
import { StatusWithBadge } from './StatusWithBadge';

function renderStatus(props: {
  status: 'pending' | 'in_progress';
  overdue: boolean;
  pill?: boolean;
}) {
  render(
    <ThemeProvider theme={theme}>
      <StatusWithBadge {...props} />
    </ThemeProvider>,
  );
}

const chipOf = (label: string) => screen.getByText(label).parentElement!;

describe('StatusWithBadge: aparência', () => {
  it('o selo "Atrasada" é suave: fundo claro do tema, texto em vermelho e um ícone, e não um vermelho cheio', () => {
    renderStatus({ status: 'pending', overdue: true, pill: true });

    const badge = chipOf('Atrasada');

    expect(getComputedStyle(badge).backgroundColor).not.toBe(
      'rgba(0, 0, 0, 0)',
    );
    expect(getComputedStyle(badge).backgroundColor).not.toBe(
      theme.palette.error.main,
    );
    expect(badge.querySelector('svg')).not.toBeNull();
    expect(getComputedStyle(badge).color).toBe('rgb(179, 38, 30)');
  });

  it('em pílula, a situação leva a cor da situação, com contorno', () => {
    renderStatus({ status: 'in_progress', overdue: false, pill: true });

    const pill = chipOf('Em andamento');

    expect(getComputedStyle(pill).color).toBe('rgb(15, 100, 96)');
    expect(getComputedStyle(pill).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('sem pílula (o detalhe), a situação continua em texto simples', () => {
    renderStatus({ status: 'pending', overdue: false });

    expect(screen.getByText('Pendente').closest('.MuiChip-root')).toBeNull();
  });
});
