import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const PASSWORD_INPUT = 'export const Field = () => <input type="password" />;';

async function lint(code: string, filePath: string) {
  const [result] = await new ESLint().lintText(code, { filePath });
  return result!.messages.filter(
    (message) => message.ruleId === 'no-restricted-syntax',
  );
}

describe('Regra de lint dos campos de senha (RNF29)', () => {
  it('proíbe type="password" fora do PasswordField, para um campo novo não escapar da padronização', async () => {
    const messages = await lint(PASSWORD_INPUT, 'src/pages/NewPage.tsx');

    expect(messages).toHaveLength(1);
    expect(messages[0]!.message).toMatch(/PasswordField/);
  });

  it('proíbe também o type de senha passado como expressão', async () => {
    const messages = await lint(
      "export const Field = () => <input type={'password'} />;",
      'src/registration/Other.tsx',
    );

    expect(messages).toHaveLength(1);
  });

  it('deixa o PasswordField usar o type de senha', async () => {
    const messages = await lint(
      "export const Field = ({ shown }: { shown: boolean }) => <input type={shown ? 'text' : 'password'} />;",
      'src/components/PasswordField.tsx',
    );

    expect(messages).toHaveLength(0);
  });

  it('não atrapalha os outros tipos de campo', async () => {
    const messages = await lint(
      'export const Field = () => <input type="email" />;',
      'src/pages/NewPage.tsx',
    );

    expect(messages).toHaveLength(0);
  });
});
