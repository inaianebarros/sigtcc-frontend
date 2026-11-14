import { act, screen } from '@testing-library/react';
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

  it('leva a rota raiz para a tela de login, com os acessos de recuperação e de cadastro', async () => {
    renderApp('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/login$/);
    expect(screen.getByRole('link', { name: /Esqueci/ })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Cadastrar como aluno' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Cadastrar como professor' }),
    ).toBeInTheDocument();
  });

  it('troca a raiz pelo login no histórico: o Voltar não volta a uma raiz que só redireciona', async () => {
    const { router } = renderApp('/', { entries: ['/nada', '/'] });
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });

    await act(() => router.navigate(-1));

    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/nada$/);
  });

  it.each(['/login', '/cadastro/aluno', '/recuperar-senha'])(
    'mantém a tela pública %s como era',
    async (path) => {
      renderApp(path);

      await screen.findByRole('heading', { level: 1 });
      expect(screen.getByTestId('location')).toHaveTextContent(path);
    },
  );

  it('renderiza a página 404 em rota desconhecida', async () => {
    renderApp('/nada');

    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
  });
});
