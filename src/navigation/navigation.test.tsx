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

  it('mostra ao aluno os itens Dashboard, Orientadores, Minha solicitação, Histórico de orientações e Meu perfil e abre no Dashboard', async () => {
    mockApi(sessionOf('student', { has_active_advising: false }));

    renderApp('/login');

    await screen.findByRole('heading', { name: 'Dashboard' });
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Dashboard',
      'Orientadores',
      'Minha solicitação',
      'Histórico de orientações',
      'Meu perfil',
    ]);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/dashboard',
    );
  });

  it('mostra ao professor os itens Dashboard, Solicitações, Histórico de orientações e Meu perfil e abre no Dashboard', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 0 }));

    renderApp('/login');

    await screen.findByRole('heading', { name: 'Dashboard' });
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Dashboard',
      'Solicitações',
      'Histórico de orientações',
      'Meu perfil',
    ]);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/dashboard',
    );
  });

  it('mostra ao professor sem orientando o item Orientandos desabilitado, com o motivo visível', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 0 }));

    renderApp('/login');

    const item = await screen.findByRole('button', { name: /Orientandos/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    // Orientandos, Atividades e Reuniões exigem o mesmo vínculo: o motivo aparece nos três itens.
    expect(screen.getAllByText('Requer orientando ativo')).toHaveLength(3);
    expect(
      screen.queryByRole('link', { name: 'Orientandos' }),
    ).not.toBeInTheDocument();
  });

  it('habilita os itens Orientandos e Atividades, entre Solicitações e Meu perfil, quando há orientando ativo', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 2 }));

    renderApp('/login');

    await screen.findByRole('heading', { name: 'Dashboard' });
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Dashboard',
      'Solicitações',
      'Orientandos',
      'Atividades',
      'Reuniões',
      'Histórico de orientações',
      'Meu perfil',
    ]);
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
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/dashboard',
    );
  });

  it('não mostra o menu para quem não entrou', async () => {
    mockApi({ 'POST /api/auth/refresh': { status: 401, body: {} } });

    renderApp('/');

    await screen.findByRole('heading', { level: 1, name: 'Entrar' });
    expect(
      screen.queryByRole('navigation', { name: 'Menu principal' }),
    ).not.toBeInTheDocument();
  });

  it('leva o aluno logado que abre a raiz ao Dashboard do aluno', async () => {
    mockApi(sessionOf('student', { has_active_advising: false }));

    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/dashboard$/,
    );
  });

  it('leva o professor logado que abre a raiz ao Dashboard do professor', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 0 }));

    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/dashboard$/,
    );
  });
});
