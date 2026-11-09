import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';

const NOT_SIGNED_IN = { 'POST /api/auth/refresh': { status: 401, body: {} } };

describe('LoginPage', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('mostra o formulário de login com links para cadastro e recuperação de senha', async () => {
    mockApi(NOT_SIGNED_IN);

    renderApp('/login');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    expect(
      screen.getByRole('link', { name: 'Esqueci minha senha' }),
    ).toHaveAttribute('href', '/recuperar-senha');
    expect(
      screen.getByRole('link', { name: 'Cadastrar como aluno' }),
    ).toHaveAttribute('href', '/cadastro/aluno');
    expect(
      screen.getByRole('link', { name: 'Cadastrar como professor' }),
    ).toHaveAttribute('href', '/cadastro/professor');
  });

  it('exibe os erros de validação junto dos campos sem chamar a API', async () => {
    const fetchMock = mockApi(NOT_SIGNED_IN);
    const user = userEvent.setup();
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Entrar' });

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveFocus();
    expect(requestsTo(fetchMock, 'POST /api/auth/login')).toHaveLength(0);

    await user.type(screen.getByLabelText('E-mail'), 'isto-nao-e-um-email');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('Informe um e-mail válido.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['student', 'Dashboard'],
    ['teacher', 'Dashboard'],
    ['admin', 'Área do Administrador'],
  ] as const)(
    'leva o usuário do tipo %s para a sua área depois do login',
    async (type, heading) => {
      const fetchMock = mockApi({
        ...NOT_SIGNED_IN,
        'POST /api/auth/login': {
          body: {
            access_token: 'token-de-acesso',
            user: {
              id: 7,
              full_name: 'Ana Souza',
              email: 'ana@example.com',
              type,
            },
          },
        },
      });
      const user = userEvent.setup();
      renderApp('/login');
      await screen.findByRole('heading', { name: 'Entrar' });

      await user.type(screen.getByLabelText('E-mail'), ' ana@example.com ');
      await user.type(screen.getByLabelText('Senha'), 'Senha-Segura-2026');
      await user.click(screen.getByRole('button', { name: 'Entrar' }));

      expect(
        await screen.findByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expect(screen.getByText('Ana Souza')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
      const [, init] = requestsTo(fetchMock, 'POST /api/auth/login')[0] ?? [];
      expect(JSON.parse(String(init?.body))).toEqual({
        email: 'ana@example.com',
        password: 'Senha-Segura-2026',
      });
    },
  );

  it('mostra uma mensagem de credenciais inválidas sem tratar como sessão expirada', async () => {
    const fetchMock = mockApi({
      ...NOT_SIGNED_IN,
      'POST /api/auth/login': {
        status: 401,
        body: { detail: 'E-mail ou senha inválidos.' },
      },
    });
    const user = userEvent.setup();
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Entrar' });

    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('E-mail ou senha inválidos.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sessão expirou/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(requestsTo(fetchMock, 'POST /api/auth/refresh')).toHaveLength(1);
  });

  it('desabilita o botão e mostra o carregamento enquanto o login está em andamento', async () => {
    let finishLogin: (value: MockResponse) => void = () => {};
    mockApi({
      ...NOT_SIGNED_IN,
      'POST /api/auth/login': () =>
        new Promise((resolve) => {
          finishLogin = resolve;
        }),
    });
    const user = userEvent.setup();
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Entrar' });
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'Senha-Segura-2026');

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const pending = await screen.findByRole('button', { name: 'Entrando…' });
    expect(pending).toBeDisabled();
    finishLogin({
      status: 401,
      body: { detail: 'E-mail ou senha inválidos.' },
    });
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('avisa quando não consegue falar com o servidor', async () => {
    mockApi({
      ...NOT_SIGNED_IN,
      'POST /api/auth/login': () => {
        throw new TypeError('network down');
      },
    });
    const user = userEvent.setup();
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Entrar' });

    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'Senha-Segura-2026');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText(/Não foi possível conectar ao servidor/),
    ).toBeInTheDocument();
  });

  it('mostra quanto tempo esperar quando as tentativas passam do limite', async () => {
    mockApi({
      ...NOT_SIGNED_IN,
      'POST /api/auth/login': {
        status: 429,
        body: {
          detail: 'Muitas tentativas. Aguarde antes de tentar novamente.',
        },
        headers: { 'Retry-After': '900' },
      },
    });
    const user = userEvent.setup();
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Entrar' });
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'qualquer-senha');

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText(
        'Muitas tentativas. Tente novamente em 15 minutos.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    expect(
      screen.queryByText('E-mail ou senha inválidos.'),
    ).not.toBeInTheDocument();
  });
});
