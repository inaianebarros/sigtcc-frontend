import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

function sessionOf(
  type: 'student' | 'teacher',
  extra: Record<string, unknown>,
) {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': {
      body: {
        id: 7,
        full_name: 'Ana Souza',
        email: 'ana@example.com',
        type,
        ...extra,
      },
    },
  };
}

describe('item Reuniões do menu lateral', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('fica desabilitado, com o motivo, para o aluno sem orientação ativa', async () => {
    mockApi(sessionOf('student', { has_active_advising: false }));

    renderApp('/aluno');

    const item = await screen.findByRole('button', { name: /Reuniões/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu).queryByRole('link', { name: 'Reuniões' }),
    ).not.toBeInTheDocument();
  });

  it('leva o aluno com orientação ativa à lista de reuniões, depois de Atividades', async () => {
    mockApi(sessionOf('student', { has_active_advising: true }));

    renderApp('/aluno');

    const link = await screen.findByRole('link', { name: 'Reuniões' });
    expect(link).toHaveAttribute('href', '/aluno/reunioes');
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((item) => item.textContent),
    ).toEqual([
      'Orientadores',
      'Minha solicitação',
      'Atividades',
      'Reuniões',
      'Tema do TCC',
      'Meu perfil',
    ]);
  });

  it('fica desabilitado, com o motivo, para o professor sem orientando ativo', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 0 }));

    renderApp('/professor');

    const item = await screen.findByRole('button', { name: /Reuniões/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText('Requer orientando ativo')).toHaveLength(3);
  });

  it('leva o professor com orientando ativo à lista de reuniões, depois de Atividades', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 2 }));

    renderApp('/professor');

    const link = await screen.findByRole('link', { name: 'Reuniões' });
    expect(link).toHaveAttribute('href', '/professor/reunioes');
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((item) => item.textContent),
    ).toEqual([
      'Solicitações',
      'Orientandos',
      'Atividades',
      'Reuniões',
      'Meu perfil',
    ]);
  });
});
