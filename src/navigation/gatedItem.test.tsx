import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const REASON = 'Disponível após ter um orientador ativo';

vi.mock('./areas', async (importOriginal) => {
  const original = await importOriginal<typeof import('./areas')>();
  return {
    ...original,
    areas: original.areas.map((area) =>
      area.userType === 'student'
        ? {
            ...area,
            items: [
              ...area.items,
              {
                label: 'Item de teste',
                path: '/aluno/teste',
                requiresActiveAdvising: {
                  reason: 'Disponível após ter um orientador ativo',
                },
              },
            ],
          }
        : area,
    ),
  };
});

describe('item que exige orientação ativa, no menu real', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('começa desabilitado com o motivo e é habilitado quando o servidor passa a informar a orientação, sem recarregar', async () => {
    let advising = false;
    mockApi({
      'POST /api/auth/refresh': { body: { access_token: 't' } },
      'GET /api/auth/me': () => ({
        body: {
          id: 7,
          full_name: 'Ana Souza',
          email: 'ana@example.com',
          type: 'student',
          has_active_advising: advising,
        },
      }),
    });
    renderApp('/aluno');
    // A primeira renderização com a sessão restaurada pode passar de 1 s com a máquina carregada.
    const disabled = await screen.findByRole(
      'button',
      { name: /Item de teste/ },
      { timeout: 5000 },
    );
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(REASON)).toBeVisible();

    // O ouvinte de foco é registrado num efeito que depende da sessão autenticada: o `act`
    // o descarrega antes do evento, que senão pode cair no vazio.
    await act(async () => {});
    advising = true;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(
      () =>
        expect(
          screen.getByRole('link', { name: 'Item de teste' }),
        ).toHaveAttribute('href', '/aluno/teste'),
      { timeout: 5000 },
    );
    expect(screen.queryByText(REASON)).not.toBeInTheDocument();
  });

  it('mostra a página "em breve" do item quando ele está habilitado e a pessoa o abre', async () => {
    mockApi({
      'POST /api/auth/refresh': { body: { access_token: 't' } },
      'GET /api/auth/me': {
        body: {
          id: 7,
          full_name: 'Ana Souza',
          email: 'ana@example.com',
          type: 'student',
          has_active_advising: true,
        },
      },
    });
    renderApp('/aluno/teste');

    expect(
      await screen.findByRole('heading', { name: 'Item de teste' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Em breve/)).toBeInTheDocument();
  });
});
