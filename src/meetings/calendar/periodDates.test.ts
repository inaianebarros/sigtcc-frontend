import { describe, expect, it } from 'vitest';
import { dayBefore, dayTitle, weekTitle } from './periodDates';

describe('periodDates', () => {
  it('o fim exclusivo de um período vira o último dia exibido', () => {
    expect(dayBefore('2026-12-13')).toBe('2026-12-12');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
  });

  it('o título do dia traz o dia da semana, com a inicial maiúscula', () => {
    expect(dayTitle('2026-11-10')).toBe('Terça-feira, 10 de novembro de 2026');
  });

  it('o título da semana no mesmo mês mostra o intervalo dos dias', () => {
    expect(weekTitle('2026-11-08', '2026-11-14')).toBe(
      '8 – 14 de novembro de 2026',
    );
  });

  it('o título da semana que cruza dois meses traz os dois', () => {
    expect(weekTitle('2026-11-29', '2026-12-05')).toBe(
      '29 de novembro – 5 de dezembro de 2026',
    );
  });

  it('o título da semana que cruza o ano traz o ano de cada ponta', () => {
    expect(weekTitle('2026-12-27', '2027-01-02')).toBe(
      '27 de dezembro de 2026 – 2 de janeiro de 2027',
    );
  });
});
