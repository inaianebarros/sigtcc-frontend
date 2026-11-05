import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';

const FORGOT_ROUTE = 'POST /api/auth/forgot-password';
const sessionless = { 'POST /api/auth/refresh': { status: 401, body: {} } };

async function openForm() {
  renderApp('/recuperar-senha');
  await screen.findByRole('heading', { name: 'Recuperar senha' });
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('é alcançada pelo link da tela de login', async () => {
    mockApi(sessionless);
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(
      await screen.findByRole('link', { name: 'Esqueci minha senha' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Recuperar senha' }),
    ).toBeInTheDocument();
  });

  it('exige um e-mail válido sem chamar a API', async () => {
    const fetchMock = mockApi(sessionless);
    const user = userEvent.setup();
    await openForm();

    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('E-mail'), 'sem-arroba');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(
      await screen.findByText('Informe um e-mail válido.'),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, FORGOT_ROUTE)).toHaveLength(0);
  });

  it('mostra a mesma mensagem neutra, sem revelar se o e-mail existe', async () => {
    const fetchMock = mockApi({
      ...sessionless,
      [FORGOT_ROUTE]: { status: 200, body: { detail: 'qualquer texto' } },
    });
    const user = userEvent.setup();
    await openForm();
    await user.type(screen.getByLabelText('E-mail'), 'alguem@example.com');

    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(
      await screen.findByText(
        'Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha. O link vale por 1 hora.',
      ),
    ).toBeInTheDocument();
    const [, init] = requestsTo(fetchMock, FORGOT_ROUTE)[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'alguem@example.com',
    });
    expect(
      screen.getByRole('link', { name: 'Voltar ao login' }),
    ).toHaveAttribute('href', '/login');
  });

  it('desabilita o botão e mostra o andamento durante o envio', async () => {
    let finish: (value: MockResponse) => void = () => {};
    mockApi({
      ...sessionless,
      [FORGOT_ROUTE]: () => new Promise((resolve) => (finish = resolve)),
    });
    const user = userEvent.setup();
    await openForm();
    await user.type(screen.getByLabelText('E-mail'), 'alguem@example.com');

    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(
      await screen.findByRole('button', { name: 'Enviando…' }),
    ).toBeDisabled();
    finish({ status: 200, body: {} });
    expect(await screen.findByText(/Se houver uma conta/)).toBeInTheDocument();
  });

  it('avisa quando há pedidos demais e mantém o formulário', async () => {
    mockApi({ ...sessionless, [FORGOT_ROUTE]: { status: 429, body: {} } });
    const user = userEvent.setup();
    await openForm();
    await user.type(screen.getByLabelText('E-mail'), 'alguem@example.com');

    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(
      await screen.findByText(/Muitos pedidos em pouco tempo/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue('alguem@example.com');
  });

  it('avisa quando o pedido não chega ao servidor', async () => {
    mockApi({
      ...sessionless,
      [FORGOT_ROUTE]: () => {
        throw new TypeError('network down');
      },
    });
    const user = userEvent.setup();
    await openForm();
    await user.type(screen.getByLabelText('E-mail'), 'alguem@example.com');

    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(
      await screen.findByText(/Não foi possível conectar ao servidor/),
    ).toBeInTheDocument();
  });
});
