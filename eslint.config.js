import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
          selector: "JSXAttribute[name.name='type'][value.value='password']",
          message:
            'Use o componente PasswordField em vez de type="password" (RNF29).',
        },
        {
          selector:
            "JSXAttribute[name.name='type'] > JSXExpressionContainer > Literal[value='password']",
          message:
            'Use o componente PasswordField em vez de type="password" (RNF29).',
        },
      ],
    },
  },
  prettier,
);
