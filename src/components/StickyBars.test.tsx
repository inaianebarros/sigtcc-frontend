import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { teacherProfileRoutes } from '../test/teacherProfileApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const DRAWER_Z_INDEX = 1200;
const APP_BAR_Z_INDEX = 1100;

function topBar() {
  return screen.getByRole('banner');
}

/** O painel do menu lateral permanente do desktop. */
function sidePanel() {
  return screen
    .getByRole('navigation', { name: 'Menu principal' })
    .closest('.MuiDrawer-paper') as HTMLElement;
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
});

describe('Barras que acompanham a rolagem', () => {
  it('no desktop a barra superior e o menu lateral ficam fixos na tela, com a barra por cima do menu', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');
    await screen.findByRole('navigation', { name: 'Menu principal' });

    expect(topBar()).toHaveStyle({ position: 'sticky', top: '0px' });
    expect(sidePanel()).toHaveStyle({ position: 'fixed' });
    expect(Number(getComputedStyle(topBar()).zIndex)).toBeGreaterThan(
      DRAWER_Z_INDEX,
    );
  });

  it('no desktop o primeiro item do menu começa abaixo da barra, e não escondido atrás dela', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');
    await screen.findByRole('navigation', { name: 'Menu principal' });

    const spacer = sidePanel().querySelector('.MuiToolbar-root');
    expect(spacer).not.toBeNull();
    expect(spacer?.nextElementSibling).toBe(
      screen.getByRole('navigation', { name: 'Menu principal' }),
    );
  });

  it('no celular a barra superior acompanha a rolagem e fica abaixo da gaveta do menu', async () => {
    setViewportWidth(PHONE_WIDTH);
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');
    await screen.findByRole('button', { name: 'Abrir menu' });

    expect(topBar()).toHaveStyle({ position: 'sticky', top: '0px' });
    expect(Number(getComputedStyle(topBar()).zIndex)).toBeLessThan(
      DRAWER_Z_INDEX,
    );
    expect(Number(getComputedStyle(topBar()).zIndex)).toBe(APP_BAR_Z_INDEX);
  });

  it('o foco levado a um campo deixa a folga da altura da barra, para não parar atrás dela', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');
    await screen.findByRole('navigation', { name: 'Menu principal' });

    expect(getComputedStyle(document.documentElement).scrollPaddingTop).toBe(
      '56px',
    );
  });
});
