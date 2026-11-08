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

describe('item Atividades do menu lateral', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('fica desabilitado, com o motivo, para o aluno sem orientação ativa', async () => {
    mockApi(sessionOf('student', { has_active_advising: false }));

    renderApp('/aluno');

    const item = await screen.findByRole('button', { name: /Atividades/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Requer orientação ativa')).toBeVisible();
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu).queryByRole('link', { name: 'Atividades' }),
    ).not.toBeInTheDocument();
  });

  it('leva o aluno com orientação ativa à lista de atividades', async () => {
    mockApi(sessionOf('student', { has_active_advising: true }));

    renderApp('/aluno');

    const link = await screen.findByRole('link', { name: 'Atividades' });
    expect(link).toHaveAttribute('href', '/aluno/atividades');
    expect(
      screen.queryByText('Requer orientação ativa'),
    ).not.toBeInTheDocument();
  });

  it('fica desabilitado, com o motivo, para o professor sem orientando ativo', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 0 }));

    renderApp('/professor');

    const item = await screen.findByRole('button', { name: /Atividades/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getAllByText('Requer orientando ativo').length,
    ).toBeGreaterThan(0);
  });

  it('leva o professor com orientando ativo à lista de atividades', async () => {
    mockApi(sessionOf('teacher', { active_advisees_count: 2 }));

    renderApp('/professor');

    const link = await screen.findByRole('link', { name: 'Atividades' });
    expect(link).toHaveAttribute('href', '/professor/atividades');
  });
});
