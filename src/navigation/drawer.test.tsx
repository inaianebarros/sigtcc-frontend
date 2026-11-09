import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '../services/httpClient';
import { tokenStore } from '../services/tokenStore';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';
import type { UserType } from '../types/session';

function signedInAs(type: UserType) {
  mockApi({
    'POST /api/auth/refresh': { body: { access_token: 't' } },
    'GET /api/auth/me': {
      body: {
        id: 7,
        full_name: 'Ana Souza',
        email: 'ana@example.com',
        type,
      },
    },
  });
}

describe('menu lateral recolhível', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('no desktop o menu fica sempre visível e não há botão para abrir ou fechar', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    signedInAs('student');

    renderApp('/aluno/orientadores');

    expect(
      await screen.findByRole('navigation', { name: 'Menu principal' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Abrir menu' }),
    ).not.toBeInTheDocument();
  });

  it('no celular o menu começa fechado e abre pelo botão do topo', async () => {
    setViewportWidth(PHONE_WIDTH);
    signedInAs('student');
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');

    const toggle = await screen.findByRole('button', { name: 'Abrir menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('navigation', { name: 'Menu principal' }),
    ).not.toBeInTheDocument();

    await user.click(toggle);

    const menu = await screen.findByRole('navigation', {
      name: 'Menu principal',
    });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Dashboard', 'Orientadores', 'Minha solicitação', 'Meu perfil']);
  });

  it('fecha o menu pelo botão Fechar menu', async () => {
    setViewportWidth(PHONE_WIDTH);
    signedInAs('student');
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await user.click(await screen.findByRole('button', { name: 'Abrir menu' }));

    await user.click(
      await screen.findByRole('button', { name: 'Fechar menu' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('navigation', { name: 'Menu principal' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('fecha o menu com a tecla Esc', async () => {
    setViewportWidth(PHONE_WIDTH);
    signedInAs('teacher');
    const user = userEvent.setup();
    renderApp('/professor/solicitacoes');
    await user.click(await screen.findByRole('button', { name: 'Abrir menu' }));
    await screen.findByRole('navigation', { name: 'Menu principal' });

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(
        screen.queryByRole('navigation', { name: 'Menu principal' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('leva à tela do item escolhido e fecha o menu', async () => {
    setViewportWidth(PHONE_WIDTH);
    signedInAs('student');
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await user.click(await screen.findByRole('button', { name: 'Abrir menu' }));

    await user.click(
      await screen.findByRole('link', { name: 'Minha solicitação' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Minha solicitação' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/solicitacao',
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('navigation', { name: 'Menu principal' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('não mostra o botão do menu ao administrador nem a quem não entrou', async () => {
    setViewportWidth(PHONE_WIDTH);
    signedInAs('admin');

    renderApp('/admin');

    await screen.findByRole('heading', { name: 'Área do Administrador' });
    expect(
      screen.queryByRole('button', { name: 'Abrir menu' }),
    ).not.toBeInTheDocument();
  });

  it('marca no menu a página atual para quem usa leitor de tela', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    signedInAs('student');

    renderApp('/aluno/perfil');

    expect(
      await screen.findByRole('link', { name: 'Meu perfil' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('link', { name: 'Orientadores' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('não reabre o menu sozinho quando a sessão expira com ele aberto e a pessoa entra de novo', async () => {
    setViewportWidth(PHONE_WIDTH);
    let renewals = 0;
    const student = {
      id: 7,
      full_name: 'Ana Souza',
      email: 'ana@example.com',
      type: 'student',
    };
    mockApi({
      'POST /api/auth/refresh': () => {
        renewals += 1;
        return renewals === 1
          ? { body: { access_token: 't' } }
          : { status: 401, body: {} };
      },
      'GET /api/auth/me': { body: student },
      'GET /api/qualquer-chamada': { status: 401, body: {} },
      'POST /api/auth/login': { body: { access_token: 'novo', user: student } },
    });
    const user = userEvent.setup();
    renderApp('/aluno/orientadores');
    await user.click(await screen.findByRole('button', { name: 'Abrir menu' }));
    await screen.findByRole('navigation', { name: 'Menu principal' });

    await act(async () => {
      await httpClient.get('/qualquer-chamada').catch(() => undefined);
    });
    await screen.findByRole('heading', { name: 'Entrar' });
    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await user.type(screen.getByLabelText('Senha'), 'Senha-Segura-2026');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByRole('button', { name: 'Abrir menu' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('navigation', { name: 'Menu principal' }),
    ).not.toBeInTheDocument();
  });
});
