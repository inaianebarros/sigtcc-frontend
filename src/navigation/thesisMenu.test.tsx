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

describe('menu lateral do aluno sem o item Tema do TCC', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('não tem o item Tema do TCC, nem sem orientação ativa: o tema fica no perfil', async () => {
    mockApi(studentSession(false));

    renderApp('/aluno');

    await screen.findByRole('link', { name: 'Meu perfil' });
    expect(screen.queryByText(/Tema do TCC/)).not.toBeInTheDocument();
    // Só Atividades e Reuniões exigem o vínculo ativo.
    expect(screen.getAllByText('Requer orientação ativa')).toHaveLength(2);
  });

  it('lista os itens do aluno com orientação ativa, sem o tema, entre Reuniões e o histórico', async () => {
    mockApi(studentSession(true));

    renderApp('/aluno');

    await screen.findByRole('link', { name: 'Atividades' });
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((item) => item.textContent),
    ).toEqual([
      'Início',
      'Orientadores',
      'Minhas solicitações',
      'Atividades',
      'Reuniões',
      'Histórico de orientações',
      'Meu perfil',
    ]);
  });
});
