import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigationItem } from '../navigation/areas';
import { LocationProbe } from '../test/LocationProbe';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';
import { SideMenu } from './SideMenu';

const REASON = 'Disponível após ter um orientador ativo';

const items: readonly NavigationItem[] = [
  { label: 'Orientadores', path: '/aluno/orientadores' },
  {
    label: 'Item de teste',
    path: '/aluno/teste',
    requiresActiveAdvising: { reason: REASON },
  },
];

function renderMenu(hasActiveAdvising: boolean) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter initialEntries={['/aluno/orientadores']}>
        <LocationProbe />
        <SideMenu items={items} hasActiveAdvising={hasActiveAdvising} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('SideMenu', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('mostra o item que exige orientação ativa desabilitado, com o motivo sempre visível', () => {
    renderMenu(false);

    const item = screen.getByRole('button', { name: /Item de teste/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(REASON)).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /Item de teste/ }),
    ).not.toBeInTheDocument();
  });

  it('não leva a lugar nenhum ao clicar no item desabilitado nem ao usar o teclado', async () => {
    const user = userEvent.setup();
    renderMenu(false);

    await user.click(screen.getByRole('button', { name: /Item de teste/ }));
    screen.getByRole('button', { name: /Item de teste/ }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/orientadores',
    );
  });

  it('mantém o item desabilitado alcançável pelo teclado e sem a opacidade do estado desabilitado do MUI', async () => {
    const user = userEvent.setup();
    renderMenu(false);

    await user.tab();
    await user.tab();

    const item = screen.getByRole('button', { name: /Item de teste/ });
    expect(item).toHaveFocus();
    expect(item).not.toHaveClass('Mui-disabled');
  });

  it('habilita o item e esconde o motivo quando há orientação ativa', async () => {
    const user = userEvent.setup();
    renderMenu(true);

    const link = screen.getByRole('link', { name: 'Item de teste' });
    expect(link).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByText(REASON)).not.toBeInTheDocument();
    await user.click(link);

    expect(screen.getByTestId('location')).toHaveTextContent('/aluno/teste');
  });

  it('deixa sempre habilitado o item que não exige orientação ativa', () => {
    renderMenu(false);

    expect(screen.getByRole('link', { name: 'Orientadores' })).toBeEnabled();
  });
});
