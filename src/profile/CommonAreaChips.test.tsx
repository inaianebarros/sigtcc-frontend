import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommonAreaChips } from './CommonAreaChips';

const AREAS = [
  { id: 1, name: 'Banco de Dados', isCommon: true },
  { id: 2, name: 'Redes', isCommon: false },
];

describe('CommonAreaChips', () => {
  it('destaca as áreas em comum e conta pelo total informado', () => {
    render(<CommonAreaChips areas={AREAS} compatibility={1} />);

    const items = within(
      screen.getByRole('list', { name: 'Áreas de interesse' }),
    ).getAllByRole('listitem');

    expect(screen.getByText('1 área em comum')).toBeVisible();
    expect(items[0]!.querySelector('.MuiChip-filled')).not.toBeNull();
    expect(items[1]!.querySelector('.MuiChip-outlined')).not.toBeNull();
  });

  it('sem nenhuma área cadastrada, diz isso em texto', () => {
    render(<CommonAreaChips areas={[]} compatibility={0} />);

    expect(
      screen.getByText('Nenhuma área de interesse cadastrada.'),
    ).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
