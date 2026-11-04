import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './routes';

describe('AppRoutes', () => {
  it('renderiza a página inicial na rota raiz', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'SIGTCC' }),
    ).toBeInTheDocument();
  });

  it('renderiza a página 404 em rota desconhecida', () => {
    render(
      <MemoryRouter initialEntries={['/nada']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
  });
});
