import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';

const RESET_ROUTE = 'POST /api/auth/reset-password';
const LINK = '/redefinir-senha?uid=MQ&token=abc-123';
const NEW_PASSWORD = 'Nova-Senha-2026';
const sessionless = { 'POST /api/auth/refresh': { status: 401, body: {} } };

async function openForm(path = LINK) {
  renderApp(path);
  await screen.findByRole('heading', { name: 'Redefinir senha' });
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nova senha'), NEW_PASSWORD);
  await user.type(
    screen.getByLabelText('Confirmação da nova senha'),
    NEW_PASSWORD,
  );
  await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('remove uid e token da URL e ainda os envia na redefinição', async () => {
    const fetchMock = mockApi({
      ...sessionless,
      [RESET_ROUTE]: { status: 200, body: {} },
    });
    const user = userEvent.setup();
    await openForm();

    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/redefinir-senha$/,
    );
    await fillAndSubmit(user);

    await screen.findByRole('heading', { name: 'Entrar' });
    const [, init] = requestsTo(fetchMock, RESET_ROUTE)[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      uid: 'MQ',
      token: 'abc-123',
      password: NEW_PASSWORD,
      password_confirmation: NEW_PASSWORD,
    });
  });

  it('exige as duas senhas e a confirmação igual, sem chamar a API', async () => {
    const fetchMock = mockApi(sessionless);
    const user = userEvent.setup();
    await openForm();

    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(
      await screen.findByText('Informe a nova senha.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Confirme a nova senha.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nova senha'), NEW_PASSWORD);
    await user.type(
      screen.getByLabelText('Confirmação da nova senha'),
      'Outra-2026',
    );
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(
      await screen.findByText('As senhas não coincidem.'),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, RESET_ROUTE)).toHaveLength(0);
  });

  it('com sucesso, leva ao login com o aviso', async () => {
    mockApi({ ...sessionless, [RESET_ROUTE]: { status: 200, body: {} } });
    const user = userEvent.setup();
    await openForm();

    await fillAndSubmit(user);

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Senha redefinida com sucesso. Entre com a nova senha.'),
    ).toBeInTheDocument();
  });

  it('mostra os erros de senha do servidor no campo e mantém o link utilizável', async () => {
    mockApi({
      ...sessionless,
      [RESET_ROUTE]: {
        status: 422,
        body: {
          detail: [
            {
              loc: ['body', 'payload', 'password'],
              msg: 'Esta senha é muito comum.',
            },
          ],
        },
      },
    });
    const user = userEvent.setup();
    await openForm();

    await fillAndSubmit(user);

    expect(
      await screen.findByLabelText('Nova senha'),
    ).toHaveAccessibleDescription('Esta senha é muito comum.');
    expect(
      screen.getByRole('button', { name: 'Redefinir senha' }),
    ).toBeEnabled();
  });

  it('explica o link inválido ou expirado e oferece pedir outro', async () => {
    mockApi({
      ...sessionless,
      [RESET_ROUTE]: {
        status: 400,
        body: { detail: 'Link de redefinição inválido ou expirado.' },
      },
    });
    const user = userEvent.setup();
    await openForm();

    await fillAndSubmit(user);

    expect(
      await screen.findByText(
        /Este link de redefinição é inválido, expirou ou já foi usado/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Solicitar novo link' }));
    expect(
      await screen.findByRole('heading', { name: 'Recuperar senha' }),
    ).toBeInTheDocument();
  });

  it('trata como inválido o endereço sem uid ou token, sem chamar a API', async () => {
    const fetchMock = mockApi(sessionless);
    renderApp('/redefinir-senha');

    expect(
      await screen.findByText(/Este link de redefinição é inválido/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Solicitar novo link' }),
    ).toHaveAttribute('href', '/recuperar-senha');
    expect(requestsTo(fetchMock, RESET_ROUTE)).toHaveLength(0);
  });

  it('desabilita o botão e mostra o andamento durante o envio', async () => {
    let finish: (value: MockResponse) => void = () => {};
    mockApi({
      ...sessionless,
      [RESET_ROUTE]: () => new Promise((resolve) => (finish = resolve)),
    });
    const user = userEvent.setup();
    await openForm();

    await fillAndSubmit(user);

    expect(
      await screen.findByRole('button', { name: 'Redefinindo…' }),
    ).toBeDisabled();
    finish({ status: 200, body: {} });
    await screen.findByRole('heading', { name: 'Entrar' });
  });

  it('avisa quando o envio não chega ao servidor', async () => {
    mockApi({
      ...sessionless,
      [RESET_ROUTE]: () => {
        throw new TypeError('network down');
      },
    });
    const user = userEvent.setup();
    await openForm();

    await fillAndSubmit(user);

    expect(
      await screen.findByText(/Não foi possível conectar ao servidor/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument();
  });
});
