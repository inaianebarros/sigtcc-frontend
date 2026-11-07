import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Advisee } from '../services/adviseeService';
import { AdviseeCard } from './AdviseeCard';

const ADVISEE: Advisee = {
  advisingId: 1,
  student: {
    id: 101,
    fullName: 'Ana Souza',
    course: { id: 10, name: 'Ciência da Computação' },
  },
  startedAt: '2026-11-02T14:30:00Z',
  thesisTopic: null,
  activities: { pending: 1, inProgress: 2, inReview: 3, completed: 4 },
};

describe('AdviseeCard: pontos de encaixe', () => {
  it('sem encaixes, mostra o nome como texto simples e não tem ações', () => {
    render(<AdviseeCard advisee={ADVISEE} />);

    const card = screen.getByRole('article', { name: 'Ana Souza' });

    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('deixa a tela da #31 envolver o nome, por exemplo num link, sem mudar o título do cartão', () => {
    render(
      <AdviseeCard
        advisee={ADVISEE}
        wrapName={(name) => <a href="/perfil/101">{name}</a>}
      />,
    );

    expect(screen.getByRole('link', { name: 'Ana Souza' })).toHaveAttribute(
      'href',
      '/perfil/101',
    );
    expect(
      screen.getByRole('article', { name: 'Ana Souza' }),
    ).toBeInTheDocument();
  });

  it('deixa a tela da #33 acrescentar ações ao cartão', () => {
    render(
      <AdviseeCard
        advisee={ADVISEE}
        actions={<button type="button">Encerrar orientação</button>}
      />,
    );

    expect(
      within(screen.getByRole('article', { name: 'Ana Souza' })).getByRole(
        'button',
        { name: 'Encerrar orientação' },
      ),
    ).toBeInTheDocument();
  });
});
