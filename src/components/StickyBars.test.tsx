import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { teacherProfileRoutes } from '../test/teacherProfileApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const DRAWER_Z_INDEX = 1200;

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

function scroller() {
  return screen.getByRole('main');
}

describe('Rolagem só na área de conteúdo, abaixo da barra superior', () => {
  it('no desktop a casca não rola: a barra superior fica fora da área que rola e ocupa toda a largura', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');
    await screen.findByRole('navigation', { name: 'Menu principal' });

    const shell = topBar().parentElement as HTMLElement;
    expect(shell).toHaveStyle({ overflow: 'hidden', display: 'flex' });
    expect(topBar()).toHaveStyle({ position: 'static' });
    expect(scroller()).toHaveStyle({ overflowY: 'auto' });
    expect(scroller().contains(topBar())).toBe(false);
  });

  it('o menu lateral fica ao lado da área que rola, sem position fixed, e não rola junto', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');
    await screen.findByRole('navigation', { name: 'Menu principal' });

    expect(sidePanel()).not.toHaveStyle({ position: 'fixed' });
    expect(scroller().contains(sidePanel())).toBe(false);
    expect(sidePanel().querySelector('.MuiToolbar-root')).toBeNull();
    expect(scroller().parentElement?.contains(sidePanel())).toBe(true);
  });

  it('no celular a casca também não rola, e a barra fica abaixo da gaveta do menu', async () => {
    setViewportWidth(PHONE_WIDTH);
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');
    await screen.findByRole('button', { name: 'Abrir menu' });

    expect(topBar()).toHaveStyle({ position: 'static' });
    expect(scroller()).toHaveStyle({ overflowY: 'auto' });
    expect(Number(getComputedStyle(topBar()).zIndex)).toBeLessThan(
      DRAWER_Z_INDEX,
    );
  });

  it('o documento não guarda mais a folga do topo: quem rola é a área principal, abaixo da barra', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');
    await screen.findByRole('navigation', { name: 'Menu principal' });

    expect(getComputedStyle(document.documentElement).scrollPaddingTop).toBe(
      '',
    );
  });
});
