import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '../services/httpClient';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import type { UserType } from '../types/session';

const sessionOf = (type: UserType) => ({
  'POST /api/auth/refresh': { body: { access_token: 'novo-token' } },
  'GET /api/auth/me': {
    body: { id: 7, full_name: 'Ana Souza', email: 'ana@example.com', type },
  },
});

describe('sessão', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('restaura a sessão ao recarregar e leva quem já entrou da tela de login para a sua área', async () => {
    mockApi(sessionOf('student'));

    renderApp('/login');

    expect(
      await screen.findByRole('heading', { name: 'Orientadores' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
  });

  it('manda quem não tem sessão de uma área protegida para o login', async () => {
    mockApi({ 'POST /api/auth/refresh': { status: 401, body: {} } });

    renderApp('/aluno');

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
  });

  it('leva o usuário que abre a área de outro perfil para a sua própria área', async () => {
    mockApi(sessionOf('teacher'));

    renderApp('/admin');

    expect(
      await screen.findByRole('heading', { name: 'Solicitações' }),
    ).toBeInTheDocument();
  });

  it('encerra a sessão ao clicar em Sair e volta para o login', async () => {
    const fetchMock = mockApi({
      ...sessionOf('student'),
      'POST /api/auth/logout': { status: 204 },
    });
    const user = userEvent.setup();
    renderApp('/aluno');
    await screen.findByRole('heading', { name: 'Orientadores' });

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, 'POST /api/auth/logout')).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Sair' }),
    ).not.toBeInTheDocument();
  });

  it('volta ao login com uma mensagem clara quando a sessão expira por inatividade', async () => {
    let renewals = 0;
    mockApi({
      ...sessionOf('student'),
      'POST /api/auth/refresh': () => {
        renewals += 1;
        return renewals === 1
          ? { body: { access_token: 'novo-token' } }
          : { status: 401, body: {} };
      },
      'GET /api/qualquer-chamada': { status: 401, body: {} },
    });
    renderApp('/aluno');
    await screen.findByRole('heading', { name: 'Orientadores' });

    await act(async () => {
      await httpClient.get('/qualquer-chamada').catch(() => undefined);
    });

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sua sessão expirou por inatividade/),
    ).toBeInTheDocument();
  });

  it('faz uma única renovação ao iniciar, mesmo quando o React executa o efeito duas vezes', async () => {
    const fetchMock = mockApi(sessionOf('student'));

    renderApp('/aluno', { strict: true });

    await screen.findByRole('heading', { name: 'Orientadores' });
    expect(requestsTo(fetchMock, 'POST /api/auth/refresh')).toHaveLength(1);
  });

  it('não renova a sessão de novo quando a consulta ao usuário falha durante a restauração', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/refresh': { body: { access_token: 'novo-token' } },
      'GET /api/auth/me': { status: 401, body: {} },
    });

    renderApp('/aluno');

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, 'POST /api/auth/refresh')).toHaveLength(1);
  });

  it('volta ao login mesmo quando o servidor não responde ao pedido de logout', async () => {
    mockApi({
      ...sessionOf('student'),
      'POST /api/auth/logout': () => {
        throw new TypeError('network down');
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno');
    await screen.findByRole('heading', { name: 'Orientadores' });

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
  });
});
