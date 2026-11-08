import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { studentProfileRoutes } from '../test/studentProfileApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const ANONYMOUS: Record<string, MockResponse> = {
  'POST /api/auth/refresh': { status: 401, body: {} },
  'GET /api/institutos': { body: [] },
  'GET /api/areas-de-interesse': { body: [] },
  'GET /api/cursos': { body: [] },
};

interface Screen {
  name: string;
  path: string;
  routes: Record<string, MockResponse>;
  /** Os rótulos de todos os campos de senha da tela. */
  fields: string[];
}

// Toda tela com um campo de senha entra aqui: a padronização (RNF29) é de todas.
const SCREENS: Screen[] = [
  { name: 'login', path: '/login', routes: ANONYMOUS, fields: ['Senha'] },
  {
    name: 'cadastro de aluno',
    path: '/cadastro/aluno',
    routes: ANONYMOUS,
    fields: ['Senha', 'Confirmação de senha'],
  },
  {
    name: 'cadastro de professor',
    path: '/cadastro/professor',
    routes: ANONYMOUS,
    fields: ['Senha', 'Confirmação de senha'],
  },
  {
    name: 'redefinição de senha',
    path: '/redefinir-senha?uid=MQ&token=abc',
    routes: ANONYMOUS,
    fields: ['Nova senha', 'Confirmação da nova senha'],
  },
  {
    name: 'alteração de senha',
    path: '/aluno/perfil/senha',
    routes: studentProfileRoutes(),
    fields: ['Senha atual', 'Nova senha', 'Confirmação da nova senha'],
  },
];

const toggleName = (label: string) => `Mostrar ${label.toLowerCase()}`;

function open(screenUnderTest: Screen) {
  mockApi(screenUnderTest.routes);
  renderApp(screenUnderTest.path);
  return userEvent.setup();
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe.each(SCREENS)('Campos de senha: $name', (screenUnderTest) => {
  it.each(screenUnderTest.fields)(
    'o campo "%s" nasce oculto, com o ícone de olho fechado e sem texto no botão',
    async (label) => {
      open(screenUnderTest);
      const field = await screen.findByLabelText(label);

      const toggle = screen.getByRole('button', { name: toggleName(label) });

      expect(field).toHaveAttribute('type', 'password');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(
        within(toggle).getByTestId('VisibilityOffIcon'),
      ).toBeInTheDocument();
      expect(
        within(toggle).queryByTestId('VisibilityIcon'),
      ).not.toBeInTheDocument();
      expect(toggle).toHaveTextContent('');
      expect(toggle.textContent).not.toMatch(/Mostrar|Ocultar/);
    },
  );

  it.each(screenUnderTest.fields)(
    'o campo "%s" mostra o valor com o olho aberto e volta a ocultá-lo com o olho fechado, sem perder o que foi digitado',
    async (label) => {
      const user = open(screenUnderTest);
      const field = await screen.findByLabelText(label);
      await user.type(field, 'segredo-123');
      const toggle = screen.getByRole('button', { name: toggleName(label) });

      await user.click(toggle);

      expect(field).toHaveAttribute('type', 'text');
      expect(field).toHaveValue('segredo-123');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(within(toggle).getByTestId('VisibilityIcon')).toBeInTheDocument();
      expect(
        within(toggle).queryByTestId('VisibilityOffIcon'),
      ).not.toBeInTheDocument();

      await user.click(toggle);

      expect(field).toHaveAttribute('type', 'password');
      expect(field).toHaveValue('segredo-123');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(
        within(toggle).getByTestId('VisibilityOffIcon'),
      ).toBeInTheDocument();
    },
  );

  it('mostrar um campo não mostra os outros da tela', async () => {
    const user = open(screenUnderTest);
    const [first, ...others] = screenUnderTest.fields;
    await screen.findByLabelText(first!);

    await user.click(screen.getByRole('button', { name: toggleName(first!) }));

    expect(screen.getByLabelText(first!)).toHaveAttribute('type', 'text');
    for (const label of others) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'password');
    }
  });

  it('no celular o controle continua à mão, e as telas com mais de um campo têm um controle por campo', async () => {
    setViewportWidth(PHONE_WIDTH);
    open(screenUnderTest);
    await screen.findByLabelText(screenUnderTest.fields[0]!);

    for (const label of screenUnderTest.fields) {
      expect(
        screen.getByRole('button', { name: toggleName(label) }),
      ).toBeVisible();
    }
    expect(
      screen.getAllByRole('button', { name: /^Mostrar .*(senha)/ }),
    ).toHaveLength(screenUnderTest.fields.length);
  });
});

describe('Campos de senha: foco e teclado', () => {
  const login = SCREENS[0]!;

  it('ao clicar no ícone o cursor continua no campo, e a pessoa segue digitando', async () => {
    const user = open(login);
    const field = await screen.findByLabelText('Senha');
    await user.type(field, 'abc');

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    await user.keyboard('def');

    expect(field).toHaveFocus();
    expect(field).toHaveValue('abcdef');
  });

  it.each([['{Enter}'], [' ']])(
    'o controle funciona pelo teclado (%j) e mantém o foco nele',
    async (key) => {
      const user = open(login);
      const field = await screen.findByLabelText('Senha');
      await user.type(field, 'abc');

      await user.tab();
      const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
      expect(toggle).toHaveFocus();
      await user.keyboard(key);

      expect(field).toHaveAttribute('type', 'text');
      expect(toggle).toHaveFocus();
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard(key);
      expect(field).toHaveAttribute('type', 'password');
    },
  );

  it('o nome do botão é o mesmo nos dois estados, e só o aria-pressed diz o estado (sem repetir)', async () => {
    const user = open(login);
    await screen.findByLabelText('Senha');

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(
      screen.getByRole('button', { name: 'Mostrar senha' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByRole('button', { name: /Ocultar/ }),
    ).not.toBeInTheDocument();
  });
});
