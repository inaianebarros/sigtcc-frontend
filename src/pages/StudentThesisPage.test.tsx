import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { SAVED_AT, thesisServer } from '../test/thesisApi';
import type { FakeTopic } from '../test/thesisApi';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const PATH = '/aluno/tema';
const GET = 'GET /api/tcc/tema';
const PUT = 'PUT /api/tcc/tema';
const VALID = 'Gestão de TCC com Django e React';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup({
  topic = null as FakeTopic | null,
  overrides = {} as Overrides,
} = {}) {
  const server = thesisServer({
    user: 'student',
    topic,
    overrides: overrides as never,
  });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(PATH);
  return { fetchMock, events, server };
}

function putBodies(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, PUT).map(
    ([, init]) => JSON.parse(String(init?.body)) as { description: string },
  );
}

const field = () => screen.getByRole('textbox', { name: /Tema do TCC/ });
const saveButton = () => screen.getByRole('button', { name: 'Salvar tema' });

async function ready() {
  await screen.findByRole('textbox', { name: /Tema do TCC/ });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('StudentThesisPage: carregamento', () => {
  it('mostra o esqueleto enquanto carrega e oferece Tentar novamente quando falha', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let failing = true;
    const server = thesisServer({ user: 'student' });
    const original = server.routes[GET]!;
    server.routes[GET] = async (body, url, params) => {
      await gate;
      if (failing) return { status: 500, body: {} };
      return typeof original === 'function'
        ? original(body, url, params)
        : original;
    };
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(PATH);

    expect(await screen.findByTestId('thesis-skeleton')).toBeVisible();
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    failing = false;
    await events.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    await ready();
  });

  it('sem tema cadastrado mostra o estado vazio e o formulário vazio', async () => {
    setup();

    expect(
      await screen.findByText('Você ainda não cadastrou o tema do TCC.'),
    ).toBeVisible();
    expect(field()).toHaveValue('');
    expect(saveButton()).toBeDisabled();
  });

  it('com tema mostra o texto, a data da última alteração e o formulário preenchido', async () => {
    setup({ topic: { description: VALID, updated_at: SAVED_AT } });

    await ready();

    expect(screen.getByText('Tema atual')).toBeVisible();
    expect(screen.getAllByText(VALID).length).toBeGreaterThan(0);
    expect(
      screen.getByText('Última alteração em 9 de novembro de 2026, às 09:00'),
    ).toBeVisible();
    expect(field()).toHaveValue(VALID);
    expect(saveButton()).toBeDisabled();
  });

  it('um aluno sem orientação ativa, chegando pelo endereço, vê o motivo e não o formulário', async () => {
    const server = thesisServer({ user: 'student' });
    server.endAdvising();
    mockApi(server.routes);
    renderApp(PATH);

    expect(
      await screen.findByText(
        'O tema do TCC só pode ser cadastrado com uma orientação ativa.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: /Tema do TCC/ }),
    ).not.toBeInTheDocument();
  });
});

describe('StudentThesisPage: o formulário', () => {
  it('conta os caracteres e só habilita Salvar com 10 a 1000 caracteres, sem contar as pontas', async () => {
    const { events } = setup();
    await ready();
    expect(screen.getByText('0/1000')).toBeVisible();

    await events.type(field(), '  curto  ');

    expect(screen.getByText('5/1000')).toBeVisible();
    expect(
      await screen.findByText('Informe de 10 a 1000 caracteres'),
    ).toBeVisible();
    expect(saveButton()).toBeDisabled();

    await events.clear(field());
    await events.type(field(), '1234567890');

    expect(saveButton()).toBeEnabled();
    expect(
      screen.queryByText('Informe de 10 a 1000 caracteres'),
    ).not.toBeInTheDocument();

    await events.clear(field());
    await events.click(field());
    await events.paste('x'.repeat(1001));

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('Informe de 10 a 1000 caracteres')).toBeVisible();

    await events.clear(field());
    await events.paste('y'.repeat(1000));

    expect(saveButton()).toBeEnabled();
  });

  it('mantém Salvar desabilitado quando o texto é igual ao salvo, mesmo com espaços nas pontas', async () => {
    const { events } = setup({
      topic: { description: VALID, updated_at: SAVED_AT },
    });
    await ready();

    await events.type(field(), '   ');

    expect(saveButton()).toBeDisabled();
  });

  it('cadastra o tema aparado, avisa, mostra a data nova e volta a desabilitar Salvar', async () => {
    const { fetchMock, events } = setup();
    await ready();
    await events.type(field(), `   ${VALID}   `);

    await events.click(saveButton());

    expect(await screen.findByText('Tema salvo.')).toBeVisible();
    expect(putBodies(fetchMock)).toEqual([{ description: VALID }]);
    expect(
      screen.getByText('Última alteração em 9 de novembro de 2026, às 09:00'),
    ).toBeVisible();
    expect(screen.getByText('Tema atual')).toBeVisible();
    expect(saveButton()).toBeDisabled();
  });

  it('altera o tema já cadastrado', async () => {
    const { fetchMock, events } = setup({
      topic: { description: VALID, updated_at: '2026-01-01T12:00:00Z' },
    });
    await ready();
    await events.clear(field());
    await events.type(field(), 'Um tema novo para o meu TCC');

    await events.click(saveButton());

    expect(await screen.findByText('Tema salvo.')).toBeVisible();
    expect(putBodies(fetchMock)).toEqual([
      { description: 'Um tema novo para o meu TCC' },
    ]);
    expect(
      screen.getByText('Última alteração em 9 de novembro de 2026, às 09:00'),
    ).toBeVisible();
  });

  it('mostra o andamento e não deixa enviar de novo enquanto o pedido está em curso', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup({
      overrides: {
        [PUT]: async () => {
          await gate;
          return {
            status: 201,
            body: { description: VALID, updated_at: SAVED_AT },
          };
        },
      },
    });
    await ready();
    await events.type(field(), VALID);

    await events.click(saveButton());

    expect(
      await screen.findByRole('button', { name: 'Salvando…' }),
    ).toBeDisabled();
    release();
    expect(await screen.findByText('Tema salvo.')).toBeVisible();
    expect(requestsTo(fetchMock, PUT)).toHaveLength(1);
  });

  it('leva o erro de tamanho do servidor ao campo e mantém o texto digitado', async () => {
    const { events } = setup({
      overrides: {
        [PUT]: {
          status: 422,
          body: {
            detail: [
              {
                loc: ['body', 'payload', 'description'],
                msg: 'Informe de 10 a 1000 caracteres',
                type: 'value_error',
              },
            ],
          },
        },
      },
    });
    await ready();
    await events.type(field(), VALID);

    await events.click(saveButton());

    expect(
      await screen.findByText('Informe de 10 a 1000 caracteres'),
    ).toBeVisible();
    expect(field()).toHaveValue(VALID);
  });

  it('uma falha do servidor avisa, mantém o texto e permite tentar de novo', async () => {
    let failing = true;
    const { events } = setup({
      overrides: {
        [PUT]: () =>
          failing
            ? { status: 500, body: {} }
            : {
                status: 201,
                body: { description: VALID, updated_at: SAVED_AT },
              },
      },
    });
    await ready();
    await events.type(field(), VALID);

    await events.click(saveButton());

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    expect(field()).toHaveValue(VALID);
    failing = false;
    await events.click(saveButton());

    expect(await screen.findByText('Tema salvo.')).toBeVisible();
  });
});

describe('StudentThesisPage: alterações não salvas (RNF28)', () => {
  it('mostra o aviso no topo enquanto há alteração e o tira depois de salvar', async () => {
    const { events } = setup();
    await ready();
    expect(
      screen.queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();

    await events.type(field(), VALID);

    expect(
      await screen.findByText(/Você tem alterações não salvas/),
    ).toBeVisible();
    await events.click(saveButton());
    await screen.findByText('Tema salvo.');
    await waitFor(() =>
      expect(
        screen.queryByText(/Você tem alterações não salvas/),
      ).not.toBeInTheDocument(),
    );
  });

  it('sair pelo menu com alteração pede confirmação, e continuar editando mantém o texto', async () => {
    const { events } = setup();
    await ready();
    await events.type(field(), VALID);

    await events.click(screen.getByRole('link', { name: 'Meu perfil' }));

    const confirm = await screen.findByRole('dialog', {
      name: 'Descartar alterações?',
    });
    expect(screen.getByTestId('location')).toHaveTextContent(PATH);
    await events.click(
      within(confirm).getByRole('button', { name: 'Continuar editando' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
      ).not.toBeInTheDocument(),
    );
    expect(field()).toHaveValue(VALID);

    await events.click(screen.getByRole('link', { name: 'Meu perfil' }));
    await events.click(
      await screen.findByRole('button', { name: 'Sair sem salvar' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/aluno/perfil'),
    );
  });

  it('sem alteração sai direto', async () => {
    const { events } = setup();
    await ready();

    await events.click(screen.getByRole('link', { name: 'Meu perfil' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/aluno/perfil'),
    );
  });
});

describe('StudentThesisPage: orientação encerrada com a tela aberta', () => {
  it('um 409 mostra a mensagem, mantém o texto sem edição e desabilita o item do menu', async () => {
    const server = thesisServer({
      user: 'student',
      topic: { description: VALID, updated_at: SAVED_AT },
    });
    server.routes[PUT] = () => {
      server.endAdvising();
      return {
        status: 409,
        body: {
          detail:
            'O tema do TCC só pode ser registrado com uma orientação ativa.',
        },
      };
    };
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(PATH);
    await ready();
    await events.clear(field());
    await events.type(field(), 'Um tema novo para o meu TCC');

    await events.click(saveButton());

    expect(
      await screen.findByText(
        'A orientação foi encerrada. O tema não pode mais ser alterado.',
      ),
    ).toBeVisible();
    // O texto digitado continua à vista, sem edição, e não há mais como salvar.
    expect(field()).toHaveValue('Um tema novo para o meu TCC');
    expect(field()).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Salvar tema' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(VALID).length).toBeGreaterThan(0);
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    await waitFor(() =>
      expect(
        within(menu).getByRole('button', { name: /Tema do TCC/ }),
      ).toHaveAttribute('aria-disabled', 'true'),
    );
  });
});
