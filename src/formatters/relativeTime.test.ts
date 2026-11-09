import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTime';

const NOW = new Date('2026-11-09T15:00:00Z');

function ago(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString();
}

describe('formatRelativeTime', () => {
  it.each([
    [0, 'agora'],
    [30, 'agora'],
    [59, 'agora'],
    [60, 'há 1 min'],
    [5 * 60, 'há 5 min'],
    [59 * 60, 'há 59 min'],
    [60 * 60, 'há 1 h'],
    [3 * 60 * 60, 'há 3 h'],
    [23 * 60 * 60, 'há 23 h'],
    [24 * 60 * 60, 'há 1 dia'],
    [2 * 24 * 60 * 60, 'há 2 dias'],
    [6 * 24 * 60 * 60, 'há 6 dias'],
  ])('%i segundos atrás é "%s"', (seconds, expected) => {
    expect(formatRelativeTime(ago(seconds), NOW)).toBe(expected);
  });

  it('depois de uma semana mostra a data completa', () => {
    expect(formatRelativeTime(ago(8 * 24 * 60 * 60), NOW)).toBe(
      '1 de novembro de 2026',
    );
  });

  it('um instante no futuro, por diferença de relógio, é "agora"', () => {
    expect(formatRelativeTime(ago(-120), NOW)).toBe('agora');
  });

  it('uma data inválida não quebra', () => {
    expect(formatRelativeTime('lixo', NOW)).toBe('data indisponível');
  });
});
