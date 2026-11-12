import { describe, expect, it } from 'vitest';
import { prefillFromClick } from './clickedSlot';

// 10 de novembro de 2026, ao meio-dia em Santarém (15:00 UTC).
const NOW = new Date('2026-11-10T12:00:00-03:00');

describe('prefillFromClick: o clique num dia do Mês', () => {
  it('um dia futuro preenche só a data, com início e término em branco', () => {
    expect(prefillFromClick('2026-11-20', NOW)).toEqual({
      date: '2026-11-20',
      time: '',
      endTime: '',
    });
  });

  it('o dia de hoje vale, porque ainda tem horários futuros', () => {
    expect(prefillFromClick('2026-11-10', NOW)?.date).toBe('2026-11-10');
  });

  it('o dia de hoje vale mesmo no fim do dia em Santarém, quando já é o dia seguinte em UTC', () => {
    const lateNight = new Date('2026-11-10T22:30:00-03:00');

    expect(prefillFromClick('2026-11-10', lateNight)?.date).toBe('2026-11-10');
    expect(prefillFromClick('2026-11-09', lateNight)).toBeNull();
  });

  it('um dia passado não faz nada', () => {
    expect(prefillFromClick('2026-11-09', NOW)).toBeNull();
    expect(prefillFromClick('2025-01-01', NOW)).toBeNull();
  });
});

describe('prefillFromClick: o clique numa faixa de horário do Dia ou da Semana', () => {
  it('uma faixa futura preenche a data, o início da faixa e o término uma hora depois', () => {
    expect(prefillFromClick('2026-11-10T14:30:00-03:00', NOW)).toEqual({
      date: '2026-11-10',
      time: '14:30',
      endTime: '15:30',
    });
  });

  it('o término sugerido não passa da meia-noite: a reunião termina no mesmo dia', () => {
    expect(prefillFromClick('2026-11-10T23:00:00-03:00', NOW)?.endTime).toBe(
      '23:59',
    );
    expect(prefillFromClick('2026-11-10T23:30:00-03:00', NOW)?.endTime).toBe(
      '23:59',
    );
    expect(prefillFromClick('2026-11-10T22:30:00-03:00', NOW)?.endTime).toBe(
      '23:30',
    );
  });

  it('uma faixa que já começou não é futura, nem a que começa agora', () => {
    expect(prefillFromClick('2026-11-10T11:30:00-03:00', NOW)).toBeNull();
    expect(prefillFromClick('2026-11-10T12:00:00-03:00', NOW)).toBeNull();
    expect(prefillFromClick('2026-11-10T12:30:00-03:00', NOW)).not.toBeNull();
  });

  it('um instante sem fuso é lido no horário de Santarém', () => {
    expect(prefillFromClick('2026-11-10T14:30:00', NOW)).toEqual({
      date: '2026-11-10',
      time: '14:30',
      endTime: '15:30',
    });
    expect(prefillFromClick('2026-11-10T11:30:00', NOW)).toBeNull();
  });

  it('um texto que não é uma data não faz nada', () => {
    expect(prefillFromClick('lixo', NOW)).toBeNull();
  });
});
