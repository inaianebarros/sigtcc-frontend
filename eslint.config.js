import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const PASSWORD_FIELD_MESSAGE =
  'Use o componente PasswordField em vez de um campo com type password (RNF29).';

export default tseslint.config(
  { ignores: ['dist', 'docs'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // RNF29: todo campo de senha é o PasswordField, com o ícone de olho para exibir e ocultar.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/PasswordField.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // type="password", type={'password'} e type={cond ? 'text' : 'password'}
          selector: "JSXAttribute[name.name='type'] Literal[value='password']",
          message: PASSWORD_FIELD_MESSAGE,
        },
        {
          // slotProps={{ htmlInput: { type: 'password' } }} e inputProps={{ type: 'password' }}
          selector: "Property[key.name='type'] > Literal[value='password']",
          message: PASSWORD_FIELD_MESSAGE,
        },
      ],
    },
  },
  prettier,
);
