import { describe, expect, it } from 'vitest';
import { rateLimitMessage, waitTimeText } from './apiError';

describe('waitTimeText', () => {
  it.each([
    [1, '1 segundo'],
    [45, '45 segundos'],
    [60, '1 minuto'],
    [61, '2 minutos'],
    [900, '15 minutos'],
    [3599, '1 hora'],
    [59.2, '1 minuto'],
    [0.2, '1 segundo'],
    [3600, '1 hora'],
    [3601, '2 horas'],
    [7200, '2 horas'],
  ])('escreve %i segundos como "%s"', (seconds, text) => {
    expect(waitTimeText(seconds)).toBe(text);
  });
});

describe('rateLimitMessage', () => {
  it('informa o tempo de espera', () => {
    expect(rateLimitMessage(900)).toBe(
      'Muitas tentativas. Tente novamente em 15 minutos.',
    );
  });

  it.each([undefined, 0, -5, Number.NaN])(
    'cai na mensagem sem tempo quando o valor é %s',
    (seconds) => {
      expect(rateLimitMessage(seconds)).toBe(
        'Muitas tentativas. Aguarde um pouco antes de tentar novamente.',
      );
    },
  );
});
