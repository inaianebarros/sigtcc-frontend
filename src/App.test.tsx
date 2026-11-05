import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from './services/tokenStore';
import { mockApi } from './test/mockApi';
import { renderApp } from './test/renderApp';

describe('AppRoutes', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    mockApi({ 'POST /api/auth/refresh': { status: 401, body: {} } });
  });

  it('renderiza a página inicial na rota raiz', async () => {
    renderApp('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'SIGTCC' }),
    ).toBeInTheDocument();
  });

  it('renderiza a página 404 em rota desconhecida', async () => {
    renderApp('/nada');

    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
  });
});
