import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

function studentSession(hasActiveAdvising: boolean) {
  return {
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': {
      body: {
        id: 7,
        full_name: 'Ana Souza',
        email: 'ana@example.com',
        type: 'student',
        has_active_advising: hasActiveAdvising,
      },
    },
  };
}

describe('item Tema do TCC do menu lateral do aluno', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('fica desabilitado, com o motivo, sem orientação ativa', async () => {
    mockApi(studentSession(false));

    renderApp('/aluno');

    const item = await screen.findByRole('button', { name: /Tema do TCC/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    // Atividades, Reuniões e Tema do TCC exigem o mesmo vínculo: o motivo aparece nos três itens.
    expect(screen.getAllByText('Requer orientação ativa')).toHaveLength(3);
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu).queryByRole('link', { name: 'Tema do TCC' }),
    ).not.toBeInTheDocument();
  });

  it('leva à página do tema com orientação ativa, entre Atividades e Meu perfil', async () => {
    mockApi(studentSession(true));

    renderApp('/aluno');

    const link = await screen.findByRole('link', { name: 'Tema do TCC' });
    expect(link).toHaveAttribute('href', '/aluno/tema');
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((item) => item.textContent),
    ).toEqual([
      'Dashboard',
      'Orientadores',
      'Minha solicitação',
      'Atividades',
      'Reuniões',
      'Tema do TCC',
      'Histórico de orientações',
      'Meu perfil',
    ]);
  });
});
