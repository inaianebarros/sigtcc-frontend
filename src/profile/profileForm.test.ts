import { describe, expect, it } from 'vitest';
import { sameSet } from './profileForm';

describe('sameSet', () => {
  it('ignora a ordem', () => {
    expect(sameSet([1, 2, 3], [3, 1, 2])).toBe(true);
  });

  it('distingue listas com tamanhos ou elementos diferentes', () => {
    expect(sameSet([1, 2], [1])).toBe(false);
    expect(sameSet([1, 2], [1, 3])).toBe(false);
  });

  it('trata repetições como um conjunto, sem se enganar com elas', () => {
    expect(sameSet([1, 1], [1, 2])).toBe(false);
    expect(sameSet([1, 2], [1, 1])).toBe(false);
    expect(sameSet([1, 1], [1])).toBe(true);
  });
});
