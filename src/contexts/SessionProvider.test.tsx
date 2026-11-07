import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../hooks/useSession';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { SessionProvider } from './SessionProvider';

const ME = 'GET /api/auth/me';

function meBody(extra: Record<string, unknown>) {
  return {
    id: 7,
    full_name: 'Ana Souza',
    email: 'ana@example.com',
    type: 'student',
    ...extra,
  };
}

function Probe() {
  const { status, user, refreshUser } = useSession();
  return (
    <>
      <output data-testid="status">{status}</output>
      <output data-testid="state">
        {JSON.stringify({
          hasActiveAdvising: user?.hasActiveAdvising,
          activeAdviseesCount: user?.activeAdviseesCount,
        })}
      </output>
      <button onClick={() => void refreshUser()}>Atualizar</button>
    </>
  );
}

function renderProvider() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
}

async function signedIn() {
  await waitFor(() =>
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
  );
}

describe('SessionProvider: estado da orientação', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('guarda o estado da orientação que o servidor informa ao restaurar a sessão', async () => {
    mockApi({
      'POST /api/auth/refresh': { body: { access_token: 't' } },
      [ME]: { body: meBody({ has_active_advising: true }) },
    });

    renderProvider();
    await signedIn();

    expect(screen.getByTestId('state')).toHaveTextContent(
      '{"hasActiveAdvising":true}',
    );
  });

  it('guarda a quantidade de orientandos ativos do professor', async () => {
    mockApi({
      'POST /api/auth/refresh': { body: { access_token: 't' } },
      [ME]: { body: meBody({ type: 'teacher', active_advisees_count: 3 }) },
    });

    renderProvider();
    await signedIn();

    expect(screen.getByTestId('state')).toHaveTextContent(
      '{"activeAdviseesCount":3}',
    );
  });

  it('refreshUser relê /auth/me e atualiza o estado sem recarregar a página', async () => {
    let advising = false;
    mockApi({
      'POST /api/auth/refresh': { body: { access_token: 't' } },
      [ME]: () => ({ body: meBody({ has_active_advising: advising }) }),
    });
    const user = userEvent.setup();
    renderProvider();
    await signedIn();
    expect(screen.getByTestId('state')).toHaveTextContent(
      '{"hasActiveAdvising":false}',
    );

    advising = true;
    await user.click(screen.getByRole('button', { name: 'Atualizar' }));

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent(
        '{"hasActiveAdvising":true}',
      ),
    );
  });

  it('mantém o estado anterior quando a releitura falha', async () => {
    let fail = false;
    const fetchMock = mockApi({
      'POST /api/auth/refresh': { body: { access_token: 't' } },
      [ME]: () =>
        fail
          ? { status: 500, body: {} }
          : { body: meBody({ has_active_advising: true }) },
    });
    const user = userEvent.setup();
    renderProvider();
    await signedIn();

    fail = true;
    await user.click(screen.getByRole('button', { name: 'Atualizar' }));

    await waitFor(() => expect(requestsTo(fetchMock, ME)).toHaveLength(2));
    expect(screen.getByTestId('state')).toHaveTextContent(
      '{"hasActiveAdvising":true}',
    );
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
  });

  it('relê o usuário depois do login, porque a resposta do login não traz o estado', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/refresh': { status: 401, body: {} },
      'POST /api/auth/login': {
        body: {
          access_token: 'token',
          user: {
            id: 7,
            full_name: 'Ana Souza',
            email: 'ana@example.com',
            type: 'student',
          },
        },
      },
      [ME]: { body: meBody({ has_active_advising: true }) },
    });
    const user = userEvent.setup();
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Entrar' });

    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'Senha-Segura-2026');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await screen.findByRole('heading', { name: 'Orientadores' });
    await waitFor(() => expect(requestsTo(fetchMock, ME)).toHaveLength(1));
  });
});

describe('SessionProvider: releitura ao voltar para a aba', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('relê o usuário quando a janela volta ao foco', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/refresh': { body: { access_token: 't' } },
      [ME]: { body: meBody({ has_active_advising: false }) },
    });
    renderProvider();
    await signedIn();
    expect(requestsTo(fetchMock, ME)).toHaveLength(1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(requestsTo(fetchMock, ME)).toHaveLength(2));
  });

  it('relê o usuário quando a aba volta a ficar visível, mas não quando ela é escondida', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/refresh': { body: { access_token: 't' } },
      [ME]: { body: meBody({ has_active_advising: false }) },
    });
    renderProvider();
    await signedIn();
    const visibility = vi.spyOn(document, 'visibilityState', 'get');

    visibility.mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(requestsTo(fetchMock, ME)).toHaveLength(1);

    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(requestsTo(fetchMock, ME)).toHaveLength(2));
    visibility.mockRestore();
  });

  it('não relê nada para quem não entrou e não faz polling', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/refresh': { status: 401, body: {} },
    });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous'),
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(requestsTo(fetchMock, ME)).toHaveLength(0);
  });
});

describe('SessionProvider: troca de sessão durante uma releitura', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('descarta a releitura de quem saiu e ainda lê o estado de quem entrou em seguida', async () => {
    let release: (() => void) | undefined;
    const slowFirstUser = new Promise<void>((resolve) => {
      release = resolve;
    });
    let meCalls = 0;
    const fetchMock = mockApi({
      'POST /api/auth/refresh': { body: { access_token: 't' } },
      [ME]: async () => {
        meCalls += 1;
        if (meCalls === 1)
          return { body: meBody({ has_active_advising: false }) };
        if (meCalls === 2) {
          await slowFirstUser;
          return { body: meBody({ has_active_advising: true }) };
        }
        return {
          body: meBody({
            id: 8,
            full_name: 'Bia Lima',
            has_active_advising: false,
          }),
        };
      },
      'POST /api/auth/logout': { status: 204 },
      'POST /api/auth/login': {
        body: {
          access_token: 'token-b',
          user: {
            id: 8,
            full_name: 'Bia Lima',
            email: 'bia@example.com',
            type: 'student',
          },
        },
      },
    });
    function Both() {
      const { user, refreshUser, signOut, signIn } = useSession();
      return (
        <>
          <output data-testid="who">{`${user?.id ?? 'ninguém'}:${user?.hasActiveAdvising}`}</output>
          <button onClick={() => void refreshUser()}>Atualizar</button>
          <button onClick={() => void signOut()}>Sair</button>
          <button onClick={() => void signIn('bia@example.com', 'x')}>
            Entrar
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <Both />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('who')).toHaveTextContent('7:false'),
    );

    await user.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(requestsTo(fetchMock, ME)).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(requestsTo(fetchMock, ME)).toHaveLength(3));
    await waitFor(() =>
      expect(screen.getByTestId('who')).toHaveTextContent('8:false'),
    );

    await act(async () => {
      release?.();
      await slowFirstUser;
    });

    expect(screen.getByTestId('who')).toHaveTextContent('8:false');
  });
});
