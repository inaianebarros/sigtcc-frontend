import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { tokenStore } from './services/tokenStore';
import { mockApi } from './test/mockApi';

vi.mock('./pages/LoginPage', () => ({
  LoginPage: () => {
    throw new Error('payload inesperado');
  },
}));

describe('App: erro de renderização numa rota', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    mockApi({ 'POST /api/auth/refresh': { status: 401, body: {} } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('mostra o aviso em português do app, e não a tela de erro padrão do roteador', async () => {
    window.history.pushState({}, '', '/login');

    render(<App />);

    expect(
      await screen.findByText(/Ocorreu um erro inesperado/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Unexpected Application Error/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/payload inesperado/)).not.toBeInTheDocument();
  });
});
