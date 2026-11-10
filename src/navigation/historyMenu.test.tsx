import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { historyRoutes, makeEndedAdvising } from '../test/advisingHistoryApi';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const ITEM = 'Histórico de orientações';

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('item Histórico de orientações do menu lateral', () => {
  it.each([
    ['student', '/aluno/historico', 'Minha solicitação'],
    ['teacher', '/professor/historico', 'Solicitações'],
  ] as const)(
    'o %s tem o item habilitado, sem orientação ativa, logo antes de Meu perfil',
    async (user, path, previous) => {
      mockApi(historyRoutes([makeEndedAdvising(1)], user));
      renderApp(path);

      const link = await screen.findByRole('link', { name: ITEM });
      const menu = screen.getByRole('navigation', { name: 'Menu principal' });
      const labels = within(menu)
        .getAllByRole('link')
        .map((item) => item.textContent);

      expect(link).toHaveAttribute('href', path);
      expect(link).not.toHaveAttribute('aria-disabled', 'true');
      const index = labels.indexOf(ITEM);
      expect(labels[index - 1]).toBe(previous);
      expect(labels[index + 1]).toBe('Meu perfil');
    },
  );

  it('o item leva ao histórico e fica marcado como a página atual', async () => {
    mockApi(historyRoutes([makeEndedAdvising(1)], 'student'));
    const person = userEvent.setup();
    renderApp('/aluno/perfil');

    await person.click(await screen.findByRole('link', { name: ITEM }));

    expect(
      await screen.findByRole('heading', { level: 1, name: ITEM }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/historico',
    );
    expect(screen.getByRole('link', { name: ITEM })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
