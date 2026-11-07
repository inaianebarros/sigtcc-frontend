import { describe, expect, it } from 'vitest';
import type { SessionUser } from '../types/session';
import { hasActiveAdvisingOf } from './advisingState';

const base: SessionUser = {
  id: 1,
  fullName: 'Ana',
  email: 'ana@example.com',
  type: 'student',
};

describe('hasActiveAdvisingOf', () => {
  it('para o aluno, vale o que o servidor informou', () => {
    expect(hasActiveAdvisingOf({ ...base, hasActiveAdvising: true })).toBe(
      true,
    );
    expect(hasActiveAdvisingOf({ ...base, hasActiveAdvising: false })).toBe(
      false,
    );
  });

  it('para o aluno, a falta da informação conta como sem orientação', () => {
    expect(hasActiveAdvisingOf(base)).toBe(false);
  });

  it('para o professor, basta ter ao menos um orientando ativo', () => {
    const teacher = { ...base, type: 'teacher' } as const;

    expect(hasActiveAdvisingOf({ ...teacher, activeAdviseesCount: 2 })).toBe(
      true,
    );
    expect(hasActiveAdvisingOf({ ...teacher, activeAdviseesCount: 0 })).toBe(
      false,
    );
    expect(hasActiveAdvisingOf(teacher)).toBe(false);
  });

  it('o administrador não depende de orientação', () => {
    expect(hasActiveAdvisingOf({ ...base, type: 'admin' })).toBe(false);
  });
});
