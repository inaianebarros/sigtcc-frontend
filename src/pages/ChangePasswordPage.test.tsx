import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { studentProfileRoutes } from '../test/studentProfileApi';
import { teacherProfileRoutes } from '../test/teacherProfileApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const CHANGE = 'POST /api/auth/change-password';
const STUDENT_PATH = '/aluno/perfil/senha';
const TEACHER_PATH = '/professor/perfil/senha';
const CURRENT = 'senha-atual-123';
const NEW = 'NovaSenha#456';

type Handler = MockResponse | ((body: unknown) => MockResponse);

function setup(
  change: Handler = { body: { access_token: 'novo-token' } },
  path = STUDENT_PATH,
) {
  const routes =
    path === TEACHER_PATH ? teacherProfileRoutes() : studentProfileRoutes();
  const fetchMock = mockApi({ ...routes, [CHANGE]: change });
  const user = userEvent.setup();
  renderApp(path);
  return { fetchMock, user };
}

const field = (name: string) => screen.getByLabelText(name);

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  { current = CURRENT, password = NEW, confirmation = NEW } = {},
) {
  await screen.findByRole('heading', { level: 1, name: 'Alterar senha' });
  if (current) await user.type(field('Senha atual'), current);
  if (password) await user.type(field('Nova senha'), password);
  if (confirmation)
    await user.type(field('Confirmação da nova senha'), confirmation);
}

/** O layout tem outra região `status`: o aviso de sucesso se acha pelo texto. */
async function successNotice() {
  const text = await screen.findByText(/Senha alterada com sucesso/);
  return text.closest('[role="status"]') as HTMLElement;
}

function submit(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
}

function bodyOf(fetchMock: ReturnType<typeof mockApi>, index = 0) {
  return JSON.parse(String(requestsTo(fetchMock, CHANGE)[index]?.[1]?.body));
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('ChangePasswordPage: o formulário', () => {
  it('abre em /aluno/perfil/senha com os três campos, o botão e o "Cancelar" de volta ao perfil', async () => {
    setup();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Alterar senha' }),
    ).toBeInTheDocument();

    expect(field('Senha atual')).toHaveAttribute('type', 'password');
    expect(field('Senha atual')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(field('Nova senha')).toHaveAttribute('autocomplete', 'new-password');
    expect(field('Confirmação da nova senha')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    expect(
      screen.getByRole('button', { name: 'Salvar nova senha' }),
    ).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
      'href',
      '/aluno/perfil',
    );
  });

  it('abre em /professor/perfil/senha e o "Cancelar" volta ao perfil do professor', async () => {
    setup(undefined, TEACHER_PATH);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Alterar senha' }),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
      'href',
      '/professor/perfil',
    );
  });

  it('um professor não abre a rota do aluno, e um aluno não abre a do professor', async () => {
    mockApi(teacherProfileRoutes());
    renderApp(STUDENT_PATH);

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/professor/solicitacoes',
      ),
    );
  });

  it('com os campos vazios, mostra um erro em cada um e não envia nada', async () => {
    const { fetchMock, user } = setup();
    await screen.findByRole('heading', { level: 1, name: 'Alterar senha' });

    await submit(user);

    expect(await screen.findByText('Informe a senha atual.')).toBeVisible();
    expect(screen.getByText('Informe a nova senha.')).toBeVisible();
    expect(screen.getByText('Confirme a nova senha.')).toBeVisible();
    expect(requestsTo(fetchMock, CHANGE)).toHaveLength(0);
  });

  it('com a confirmação diferente, o erro aparece na confirmação e nada é enviado', async () => {
    const { fetchMock, user } = setup();
    await fill(user, { confirmation: 'OutraSenha#789' });

    await submit(user);

    expect(await screen.findByText('As senhas não coincidem.')).toBeVisible();
    expect(field('Confirmação da nova senha')).toBeInvalid();
    expect(requestsTo(fetchMock, CHANGE)).toHaveLength(0);
  });

  it.each([
    ['Senha atual', 'senha atual'],
    ['Nova senha', 'nova senha'],
    ['Confirmação da nova senha', 'confirmação da nova senha'],
  ])(
    'o campo "%s" tem o controle de mostrar e ocultar, com nome acessível',
    async (label, lower) => {
      const { user } = setup();
      await screen.findByRole('heading', { level: 1, name: 'Alterar senha' });
      await user.type(field(label), 'segredo');

      const show = screen.getByRole('button', { name: `Mostrar ${lower}` });
      expect(show).toHaveAttribute('aria-pressed', 'false');
      await user.click(show);

      expect(field(label)).toHaveAttribute('type', 'text');
      expect(field(label)).toHaveValue('segredo');
      const hide = screen.getByRole('button', { name: `Ocultar ${lower}` });
      expect(hide).toHaveAttribute('aria-pressed', 'true');
      await user.click(hide);
      expect(field(label)).toHaveAttribute('type', 'password');
    },
  );

  it('mostrar um campo não mostra os outros', async () => {
    const { user } = setup();
    await screen.findByRole('heading', { level: 1, name: 'Alterar senha' });

    await user.click(
      screen.getByRole('button', { name: 'Mostrar nova senha' }),
    );

    expect(field('Nova senha')).toHaveAttribute('type', 'text');
    expect(field('Senha atual')).toHaveAttribute('type', 'password');
    expect(field('Confirmação da nova senha')).toHaveAttribute(
      'type',
      'password',
    );
  });
});

describe('ChangePasswordPage: a troca', () => {
  it('envia os três campos, guarda o novo token, limpa o formulário e avisa que os outros dispositivos foram desconectados', async () => {
    const { fetchMock, user } = setup();
    await fill(user);

    await submit(user);

    const status = await successNotice();
    expect(status).toHaveTextContent('Senha alterada com sucesso.');
    expect(status).toHaveTextContent(
      'Os outros dispositivos foram desconectados.',
    );
    expect(bodyOf(fetchMock)).toEqual({
      current_password: CURRENT,
      password: NEW,
      password_confirmation: NEW,
    });
    expect(tokenStore.get()).toBe('novo-token');
    expect(field('Senha atual')).toHaveValue('');
    expect(field('Nova senha')).toHaveValue('');
    expect(field('Confirmação da nova senha')).toHaveValue('');
    expect(status.textContent).not.toContain(CURRENT);
    expect(status.textContent).not.toContain(NEW);
  });

  it('este dispositivo continua conectado: o pedido seguinte já leva o novo token, sem pedir login', async () => {
    const { fetchMock, user } = setup();
    await fill(user);
    await submit(user);
    await successNotice();

    await user.click(screen.getByRole('link', { name: 'Voltar ao perfil' }));

    expect(await screen.findByLabelText('Nome completo')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/perfil$/,
    );
    const profileCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/alunos/me/perfil'),
    );
    expect(new Headers(profileCall?.[1]?.headers).get('Authorization')).toBe(
      'Bearer novo-token',
    );
  });

  it('enquanto envia, o botão fica bloqueado e o pedido sai uma vez só', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = mockApi({
      ...studentProfileRoutes(),
      [CHANGE]: async () => {
        await gate;
        return { body: { access_token: 'novo-token' } };
      },
    });
    const user = userEvent.setup();
    renderApp(STUDENT_PATH);
    await fill(user);

    await submit(user);

    const busy = await screen.findByRole('button', { name: 'Salvando…' });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(requestsTo(fetchMock, CHANGE)).toHaveLength(1);
    release?.();
    expect(await successNotice()).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Salvar nova senha' }),
    ).toBeEnabled();
  });

  it('uma segunda troca depois do sucesso começa limpa, sem o aviso anterior', async () => {
    const { user } = setup();
    await fill(user);
    await submit(user);
    await successNotice();

    await user.type(field('Senha atual'), 'x');

    expect(
      screen.queryByText(/Senha alterada com sucesso/),
    ).not.toBeInTheDocument();
  });
});

describe('ChangePasswordPage: erros', () => {
  const detail = (...errors: [string, string][]) => ({
    status: 422,
    body: {
      detail: errors.map(([name, msg]) => ({
        loc: ['body', 'payload', name],
        msg,
        type: 'value_error',
      })),
    },
  });

  it('mostra todos os erros do servidor de uma vez, cada um no seu campo, sem alerta', async () => {
    const { user } = setup(
      detail(
        ['current_password', 'A senha atual está incorreta.'],
        ['password', 'A senha deve ter ao menos 8 caracteres.'],
        ['password_confirmation', 'As senhas não coincidem.'],
      ),
    );
    await fill(user, { password: 'curta', confirmation: 'curta' });

    await submit(user);

    expect(
      await screen.findByText('A senha atual está incorreta.'),
    ).toBeVisible();
    expect(field('Senha atual')).toBeInvalid();
    expect(
      screen.getByText('A senha deve ter ao menos 8 caracteres.'),
    ).toBeVisible();
    expect(field('Nova senha')).toBeInvalid();
    expect(screen.getByText('As senhas não coincidem.')).toBeVisible();
    expect(field('Confirmação da nova senha')).toBeInvalid();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(tokenStore.get()).toBe('t');
  });

  it('a nova senha igual à atual aparece no campo da nova senha (RN02)', async () => {
    const { user } = setup(
      detail(['password', 'A nova senha deve ser diferente da atual.']),
    );
    await fill(user, { password: CURRENT, confirmation: CURRENT });

    await submit(user);

    expect(
      await screen.findByText('A nova senha deve ser diferente da atual.'),
    ).toBeVisible();
    expect(field('Nova senha')).toBeInvalid();
    expect(field('Senha atual')).not.toBeInvalid();
  });

  it('no 429, mostra a espera lida do Retry-After, sem guardar as senhas digitadas', async () => {
    const { user } = setup({
      status: 429,
      body: { detail: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
      headers: { 'Retry-After': '900' },
    });
    await fill(user);

    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas. Tente novamente em 15 minutos.',
    );
    expect(field('Senha atual')).toHaveValue('');
    expect(field('Nova senha')).toHaveValue('');
    expect(field('Confirmação da nova senha')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Salvar nova senha' }),
    ).toBeEnabled();
  });

  it('no 429 sem o cabeçalho, mostra a mensagem sem o tempo', async () => {
    const { user } = setup({
      status: 429,
      body: { detail: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
    });
    await fill(user);

    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas. Aguarde antes de tentar novamente.',
    );
  });

  it('no 401, a sessão acabou: vai para o login com a mensagem de sessão expirada', async () => {
    mockApi({
      ...studentProfileRoutes(),
      [CHANGE]: { status: 401, body: { detail: 'Não autenticado' } },
    });
    const user = userEvent.setup();
    renderApp(STUDENT_PATH);
    await fill(user);
    // A renovação da sessão também falha: é o que acontece quando ela realmente acabou.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/auth/change-password') ||
        String(input).endsWith('/auth/refresh')
          ? new Response(JSON.stringify({ detail: 'x' }), { status: 401 })
          : new Response('{}', { status: 404 }),
      ),
    );

    await submit(user);

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/login'),
    );
    expect(
      await screen.findByText(
        'Sua sessão expirou por inatividade. Faça login novamente.',
      ),
    ).toBeVisible();
  });

  it('em outra falha, mostra o erro no alerta e não deixa as senhas na tela', async () => {
    const { user } = setup({ status: 500, body: {} });
    await fill(user);

    await submit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ocorreu um erro no servidor');
    expect(alert.textContent).not.toContain(CURRENT);
    expect(alert.textContent).not.toContain(NEW);
    expect(field('Senha atual')).toHaveValue('');
    expect(field('Nova senha')).toHaveValue('');
    expect(field('Confirmação da nova senha')).toHaveValue('');
    expect(tokenStore.get()).toBe('t');
  });

  it('o alerta de uma falha some quando a pessoa volta a digitar', async () => {
    const { user } = setup({ status: 500, body: {} });
    await fill(user);
    await submit(user);
    await screen.findByRole('alert');

    await user.type(field('Senha atual'), 'x');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ChangePasswordPage: celular', () => {
  it('funciona em tela pequena: menu recolhido, validação e troca', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { fetchMock, user } = setup();
    expect(
      await screen.findByRole('button', { name: 'Abrir menu' }),
    ).toBeInTheDocument();
    await screen.findByRole('heading', { level: 1, name: 'Alterar senha' });
    await submit(user);
    expect(await screen.findByText('Informe a senha atual.')).toBeVisible();
    await fill(user);

    await submit(user);

    expect(await successNotice()).toHaveTextContent(
      'Senha alterada com sucesso.',
    );
    expect(requestsTo(fetchMock, CHANGE)).toHaveLength(1);
    expect(
      within(screen.getByRole('main')).getByRole('link', {
        name: 'Voltar ao perfil',
      }),
    ).toBeVisible();
  });
});

describe('Entrada pelo perfil', () => {
  it('o perfil do aluno tem o botão "Alterar senha", que abre o formulário', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');

    await user.click(screen.getByRole('link', { name: 'Alterar senha' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Alterar senha' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/perfil/senha',
    );
    await user.click(screen.getByRole('link', { name: 'Cancelar' }));
    expect(await screen.findByLabelText('Nome completo')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/perfil$/,
    );
  });

  it('o perfil do professor tem o botão "Alterar senha", que abre o formulário', async () => {
    mockApi(teacherProfileRoutes());
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await screen.findByLabelText('Nome completo');

    await user.click(screen.getByRole('link', { name: 'Alterar senha' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Alterar senha' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/perfil/senha',
    );
  });

  it('com alterações do perfil por salvar, sair para a troca de senha pergunta antes (RNF28)', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await user.type(await screen.findByLabelText('Nome completo'), ' Souza');

    await user.click(screen.getByRole('link', { name: 'Alterar senha' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Descartar alterações?',
    );
  });
});
