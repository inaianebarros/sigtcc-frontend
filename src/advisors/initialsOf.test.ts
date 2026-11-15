import { describe, expect, it } from 'vitest';
import { initialsOf } from './initialsOf';

describe('initialsOf', () => {
  it.each([
    ['Marta Rocha', 'MR'],
    ['  maria  da Silva Souza ', 'MS'],
    ['Madonna', 'M'],
    ['   ', ''],
    ['élcio ávila', 'ÉÁ'],
  ])('%j vira %j', (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});
