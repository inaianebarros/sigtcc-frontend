import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDeadline } from './dateTime';

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

describe('formatDeadline', () => {
  it('escreve o dia do prazo sem deslocá-lo pelo fuso', () => {
    expect(formatDeadline('2026-12-31')).toBe('31 de dezembro de 2026');
    expect(formatDeadline('2026-01-01')).toBe('1 de janeiro de 2026');
  });

  it('não derruba a tela diante de uma data malformada', () => {
    expect(formatDeadline('amanhã')).toBe('data indisponível');
    expect(formatDeadline('2026-02-30')).toBe('data indisponível');
    expect(formatDeadline('2026-12-31T10:00:00Z')).toBe('data indisponível');
  });
});
