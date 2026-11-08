import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArticleList } from './ArticleList';

describe('ArticleList', () => {
  it('lista título e ano, e só faz link do que tem endereço da web', () => {
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
      screen.getByRole('link', { name: 'Com link (abre em uma nova aba)' }),
    ).toHaveAttribute('href', 'http://exemplo.com');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('sem artigos, diz "Nenhum artigo cadastrado"', () => {
    render(<ArticleList articles={[]} />);

    expect(screen.getByText('Nenhum artigo cadastrado')).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
