import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';
import type { UserType } from '../types/session';

const sessionOf = (type: UserType, extra: Record<string, unknown> = {}) => ({
  'POST /api/auth/refresh': { body: { access_token: 'novo-token' } },
  'GET /api/auth/me': {
    body: {
      id: 7,
      full_name: 'Ana Souza',
      email: 'ana@example.com',
      type,
      ...extra,
    },
  },
});

describe('menu lateral por perfil', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('mostra ao aluno os itens Orientadores, Minha solicitação e Meu perfil e abre em Orientadores', async () => {
    mockApi(sessionOf('student', { has_active_advising: false }));

    renderApp('/login');

    await screen.findByRole('heading', { name: 'Orientadores' });
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Orientadores', 'Minha solicitação', 'Meu perfil']);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/orientadores',
    );
  });

  it('mostra ao professor os itens Solicitações e Meu perfil e abre em Solicitações', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 0 }));

    renderApp('/login');

    await screen.findByRole('heading', { name: 'Solicitações' });
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Solicitações', 'Meu perfil']);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/solicitacoes',
    );
  });

  it('mostra ao professor sem orientando o item Orientandos desabilitado, com o motivo visível', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 0 }));

    renderApp('/login');

    const item = await screen.findByRole('button', { name: /Orientandos/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByText('Disponível quando você tiver um orientando ativo'),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Orientandos' }),
    ).not.toBeInTheDocument();
  });

  it('habilita o item Orientandos, entre Solicitações e Meu perfil, quando há orientando ativo', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 2 }));

    renderApp('/login');

    await screen.findByRole('heading', { name: 'Solicitações' });
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Solicitações', 'Orientandos', 'Meu perfil']);
    expect(
      within(menu).getByRole('link', { name: 'Orientandos' }),
    ).toHaveAttribute('href', '/professor/orientandos');
  });

  it('não muda a área do administrador e não mostra menu lateral para ele', async () => {
    mockApi(sessionOf('admin'));

    renderApp('/login');

    expect(
      await screen.findByRole('heading', { name: 'Área do Administrador' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Menu principal' }),
    ).not.toBeInTheDocument();
  });

  it('leva a raiz de cada área para o item principal', async () => {
    mockApi(sessionOf('student'));

    renderApp('/aluno');

    expect(
      await screen.findByRole('heading', { name: 'Orientadores' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/orientadores',
    );
  });

  it('não mostra o menu para quem não entrou', async () => {
    mockApi({ 'POST /api/auth/refresh': { status: 401, body: {} } });

    renderApp('/');

    await screen.findByRole('heading', { level: 1, name: 'SIGTCC' });
    expect(
      screen.queryByRole('navigation', { name: 'Menu principal' }),
    ).not.toBeInTheDocument();
  });
});
