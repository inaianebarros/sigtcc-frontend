import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArticleList } from './ArticleList';

describe('ArticleList', () => {
  it('mostra título e ano em cartões, e só faz link do que tem endereço da web', () => {
    render(
      <ArticleList
        articles={[
          { title: 'Com link', year: 2025, url: 'http://exemplo.com' },
          { title: 'Sem link', year: 2024, url: '' },
          { title: 'Esquisito', year: 2023, url: 'ftp://exemplo.com' },
        ]}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: 'Com link (abre em nova aba)' }),
    ).toHaveAttribute('href', 'http://exemplo.com');
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['Com link (abre em nova aba)', 'Sem link', 'Esquisito']);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('sem artigos, diz o texto informado, ou "Nenhum artigo cadastrado" por padrão', () => {
    const { unmount } = render(
      <ArticleList articles={[]} emptyText="Ninguém publicou ainda." />,
    );
    expect(screen.getByText('Ninguém publicou ainda.')).toBeVisible();
    unmount();

    render(<ArticleList articles={[]} />);

    expect(screen.getByText('Nenhum artigo cadastrado')).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
