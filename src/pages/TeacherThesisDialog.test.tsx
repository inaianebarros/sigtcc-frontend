import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { makeAdvisee } from '../test/adviseesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { thesisServer } from '../test/thesisApi';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const PATH = '/professor/orientandos';
const GET = 'GET /api/tcc/orientandos/:id/tema';
const PUT = 'PUT /api/tcc/orientandos/:id/tema';
const VALID = 'Gestão de TCC com Django e React';
const ENDED = 'A orientação foi encerrada. O tema não pode mais ser alterado.';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup(overrides: Overrides = {}) {
  const server = thesisServer({
    user: 'teacher',
    advisees: [
      makeAdvisee(1, { thesis_topic: 'Tema atual do primeiro' }),
      makeAdvisee(2, { thesis_topic: null }),
    ],
    overrides: overrides as never,
  });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(PATH);
  return { fetchMock, events, server };
}

function putBodies(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'PUT')
    .map(
      ([, init]) => JSON.parse(String(init?.body)) as { description: string },
    );
}

const cardOf = (name: string) => screen.getByRole('article', { name });
const field = () => screen.getByRole('textbox', { name: /Tema do TCC/ });
const saveButton = () => screen.getByRole('button', { name: 'Salvar tema' });

async function openFor(
  events: ReturnType<typeof userEvent.setup>,
  button: string,
) {
  await events.click(await screen.findByRole('button', { name: button }));
  return screen.findByRole('dialog', { name: /Tema do TCC de/ });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Tema do TCC no cartão do orientando: abrir e salvar', () => {
  it('oferece Editar tema quando há tema e Cadastrar tema quando não há', async () => {
    setup();
    await screen.findByText('Orientando 2');

    expect(
      within(cardOf('Orientando 1')).getByRole('button', {
        name: 'Editar tema de Orientando 1',
      }),
    ).toHaveTextContent('Editar tema');
    expect(
      within(cardOf('Orientando 2')).getByRole('button', {
        name: 'Cadastrar tema de Orientando 2',
      }),
    ).toHaveTextContent('Cadastrar tema');
  });

  it('abre com o tema atual lido do servidor e só habilita Salvar com uma alteração válida', async () => {
    const { events } = setup();

    const dialog = await openFor(events, 'Editar tema de Orientando 1');

    await waitFor(() => expect(field()).toHaveValue('Tema atual do primeiro'));
    expect(
      within(dialog).getByRole('heading', {
        name: 'Tema do TCC de Orientando 1',
      }),
    ).toBeVisible();
    expect(saveButton()).toBeDisabled();

    await events.type(field(), ' ');
    expect(saveButton()).toBeDisabled();

    await events.clear(field());
    await events.type(field(), 'curto');
    expect(saveButton()).toBeDisabled();
    expect(
      await screen.findByText('Informe de 10 a 1000 caracteres'),
    ).toBeVisible();

    await events.clear(field());
    await events.type(field(), VALID);
    expect(saveButton()).toBeEnabled();
  });

  it('cadastra o tema aparado, fecha o diálogo, avisa e o cartão mostra o tema novo', async () => {
    const { fetchMock, events } = setup();
    await openFor(events, 'Cadastrar tema de Orientando 2');
    await events.type(field(), `   ${VALID}   `);

    await events.click(saveButton());

    expect(await screen.findByText('Tema salvo.')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /Tema do TCC de/ }),
      ).not.toBeInTheDocument(),
    );
    expect(putBodies(fetchMock)).toEqual([{ description: VALID }]);
    await waitFor(() =>
      expect(
        within(cardOf('Orientando 2')).getByText(`Tema: ${VALID}`),
      ).toBeVisible(),
    );
    expect(
      within(cardOf('Orientando 2')).getByRole('button', {
        name: 'Editar tema de Orientando 2',
      }),
    ).toBeVisible();
  });

  it('altera o tema já cadastrado e o cartão se atualiza', async () => {
    const { events } = setup();
    await openFor(events, 'Editar tema de Orientando 1');
    await waitFor(() => expect(field()).toHaveValue('Tema atual do primeiro'));
    await events.clear(field());
    await events.type(field(), 'Tema ajustado pelo orientador');

    await events.click(saveButton());

    await waitFor(() =>
      expect(
        within(cardOf('Orientando 1')).getByText(
          'Tema: Tema ajustado pelo orientador',
        ),
      ).toBeVisible(),
    );
  });

  it('mostra o esqueleto enquanto lê o tema e o andamento enquanto salva', async () => {
    let releaseRead: () => void = () => undefined;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    let releaseSave: () => void = () => undefined;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const server = thesisServer({
      user: 'teacher',
      advisees: [makeAdvisee(1, { thesis_topic: null })],
    });
    const read = server.routes[GET]!;
    const write = server.routes[PUT]!;
    server.routes[GET] = async (body, url, params) => {
      await readGate;
      return typeof read === 'function' ? read(body, url, params) : read;
    };
    server.routes[PUT] = async (body, url, params) => {
      await saveGate;
      return typeof write === 'function' ? write(body, url, params) : write;
    };
    const fetchMock = mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(PATH);
    await openFor(events, 'Cadastrar tema de Orientando 1');

    expect(screen.getByTestId('thesis-dialog-skeleton')).toBeVisible();
    releaseRead();
    await events.type(
      await screen.findByRole('textbox', { name: /Tema do TCC/ }),
      VALID,
    );
    await events.click(saveButton());

    expect(
      await screen.findByRole('button', { name: 'Salvando…' }),
    ).toBeDisabled();
    releaseSave();
    await screen.findByText('Tema salvo.');
    expect(putBodies(fetchMock)).toHaveLength(1);
  });

  it('leva o erro de tamanho do servidor ao campo e mantém o diálogo aberto', async () => {
    const { events } = setup({
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
    });
    await openFor(events, 'Cadastrar tema de Orientando 2');
    await events.type(field(), VALID);

    await events.click(saveButton());

    expect(
      await screen.findByText('Informe de 10 a 1000 caracteres'),
    ).toBeVisible();
    expect(
      screen.getByRole('dialog', { name: /Tema do TCC de/ }),
    ).toBeVisible();
    expect(field()).toHaveValue(VALID);
  });
});

describe('Tema do TCC no cartão do orientando: falhas', () => {
  it('um 404 na leitura mostra Orientando não encontrado, sem formulário', async () => {
    const { events } = setup({
      [GET]: { status: 404, body: { detail: 'Aluno não encontrado.' } },
    });
    const dialog = await openFor(events, 'Editar tema de Orientando 1');

    expect(
      await within(dialog).findByText('Orientando não encontrado'),
    ).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: /Tema do TCC/ }),
    ).not.toBeInTheDocument();
    await events.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /Tema do TCC de/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it('uma falha na leitura oferece Tentar novamente', async () => {
    let failing = true;
    const server = thesisServer({
      user: 'teacher',
      advisees: [makeAdvisee(1, { thesis_topic: 'Tema atual do primeiro' })],
    });
    const original = server.routes[GET]!;
    server.routes[GET] = (body, url, params) =>
      failing
        ? { status: 500, body: {} }
        : typeof original === 'function'
          ? original(body, url, params)
          : original;
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(PATH);
    const dialog = await openFor(events, 'Editar tema de Orientando 1');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    failing = false;

    await events.click(
      within(dialog).getByRole('button', { name: 'Tentar novamente' }),
    );

    await waitFor(() => expect(field()).toHaveValue('Tema atual do primeiro'));
  });

  it('um 404 ao salvar diz que a orientação foi encerrada, fecha o diálogo e atualiza a sessão', async () => {
    const { fetchMock, events } = setup({
      [PUT]: { status: 404, body: { detail: 'Aluno não encontrado.' } },
    });
    await openFor(events, 'Cadastrar tema de Orientando 2');
    await events.type(field(), VALID);
    const meBefore = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(saveButton());

    expect(await screen.findByText(ENDED)).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /Tema do TCC de/ }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET /api/auth/me').length).toBeGreaterThan(
        meBefore,
      ),
    );
  });
});

describe('Tema do TCC no cartão do orientando: alterações não salvas (RNF28)', () => {
  it('sem alteração, Cancelar fecha direto', async () => {
    const { events } = setup();
    const dialog = await openFor(events, 'Editar tema de Orientando 1');
    await waitFor(() => expect(field()).toHaveValue('Tema atual do primeiro'));
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /Tema do TCC de/ }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
    ).not.toBeInTheDocument();
  });

  it('com alteração mostra o aviso no topo e pede confirmação antes de fechar', async () => {
    const { events } = setup();
    const dialog = await openFor(events, 'Cadastrar tema de Orientando 2');
    await events.type(field(), 'Rascunho do tema');

    expect(
      await within(dialog).findByText(/Você tem alterações não salvas/),
    ).toBeVisible();
    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    await events.click(
      await screen.findByRole('button', { name: 'Continuar editando' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
      ).not.toBeInTheDocument(),
    );
    expect(field()).toHaveValue('Rascunho do tema');

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    await events.click(
      await screen.findByRole('button', { name: 'Sair sem salvar' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /Tema do TCC de/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it('sair da tela por um link do menu com alteração pendente pede confirmação', async () => {
    const { events } = setup();
    await openFor(events, 'Cadastrar tema de Orientando 2');
    await events.type(field(), 'Rascunho do tema');

    await events.click(
      screen.getByRole('link', { name: 'Meu perfil', hidden: true }),
    );

    expect(
      await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
    ).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(PATH);
  });
});
