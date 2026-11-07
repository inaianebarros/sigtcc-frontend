import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './dateTime';

describe('formatDate e formatDateTime', () => {
  it('escrevem a data no horário da instituição (Santarém, UTC-3)', () => {
    expect(formatDate('2026-11-02T14:30:00Z')).toBe('2 de novembro de 2026');
    expect(formatDateTime('2026-11-02T14:30:00Z')).toBe(
      '2 de novembro de 2026, às 11:30',
    );
  });

  it('não derrubam a tela diante de uma data malformada', () => {
    expect(formatDate('não é uma data')).toBe('data indisponível');
    expect(formatDateTime('')).toBe('data indisponível');
  });
});
