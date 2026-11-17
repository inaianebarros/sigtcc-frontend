import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob(
  ['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/test/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/**
 * As telas fora do menu lateral, em cartão centralizado (Login, redefinição de senha, cadastros e
 * alterar senha), e os componentes que limitam uma parte da tela, não a largura dela.
 */
const ALLOWED = new Set([
  '/src/pages/LoginPage.tsx',
  '/src/pages/ForgotPasswordPage.tsx',
  '/src/pages/ResetPasswordPage.tsx',
  '/src/pages/ChangePasswordPage.tsx',
  '/src/pages/StudentRegistrationPage.tsx',
  '/src/pages/TeacherRegistrationPage.tsx',
  // Limita só a medida do texto dos temas propostos no cartão, não a largura da tela.
  '/src/advisors/AdvisorCard.tsx',
  // O popover do sino, que não é uma tela.
  '/src/notifications/NotificationBell.tsx',
]);

/** Largura máxima ou centralização própria, escritas num `sx`: `maxWidth: 720`, `mx: 'auto'`. */
const OWN_WIDTH = /\bmaxWidth:|\bmx:\s*['"]auto['"]/;

describe('Largura das telas internas', () => {
  it('lê os arquivos das telas', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
  });

  it('as telas internas usam a largura do Layout: nenhuma limita ou centraliza a si mesma', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([path, source]) => !ALLOWED.has(path) && OWN_WIDTH.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it('as exceções existem e ainda precisam de exceção', () => {
    const stale = [...ALLOWED].filter((path) => {
      const source = SOURCES[path];
      return source === undefined || !OWN_WIDTH.test(source);
    });

    expect(stale).toEqual([]);
  });
});
