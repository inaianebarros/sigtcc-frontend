import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { studentProfileRoutes } from '../test/studentProfileApi';
import { SAVED_AT, thesisServer } from '../test/thesisApi';
import type { FakeTopic } from '../test/thesisApi';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const PATH = '/aluno/perfil';
const GET = 'GET /api/tcc/tema';
const PUT = 'PUT /api/tcc/tema';
const PATCH = 'PATCH /api/alunos/me/perfil';
const VALID = 'Gestão de TCC com Django e React';
const NO_ADVISING =
  'O tema do TCC só pode ser cadastrado com uma orientação ativa.';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup({
  topic = null as FakeTopic | null,
  overrides = {} as Overrides,
  advising = true,
  path = PATH,
} = {}) {
  const server = thesisServer({
    user: 'student',
    topic,
    overrides: overrides as never,
  });
  if (!advising) server.endAdvising();
  const fetchMock = mockApi({ ...studentProfileRoutes(), ...server.routes });
  const events = userEvent.setup();
  renderApp(path);
  return { fetchMock, events, server };
}

const section = () => screen.getByRole('region', { name: 'Tema do TCC' });
const field = () =>
  within(section()).getByRole('textbox', { name: /Tema do TCC/ });
const saveButton = () =>
  within(section()).getByRole('button', { name: 'Salvar tema' });

async function ready() {
  await screen.findByLabelText('Nome completo');
  await within(
    await screen.findByRole('region', { name: 'Tema do TCC' }),
  ).findByRole('textbox', { name: /Tema do TCC/ });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  // O jsdom não implementa a rolagem; o link "Cadastrar tema" do Dashboard abre o perfil em #tema.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Perfil do aluno: seção Tema do TCC', () => {
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
    mockApi({ ...studentProfileRoutes(), ...server.routes });
    const events = userEvent.setup();
    renderApp(PATH);

    expect(await screen.findByTestId('thesis-skeleton')).toBeVisible();
    release();
    expect(await within(section()).findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    failing = false;
    await events.click(
      within(section()).getByRole('button', { name: 'Tentar novamente' }),
    );

    await ready();
  });

  it('com orientação ativa e sem tema mostra o aviso e o campo vazio', async () => {
    setup();
    await ready();

    expect(
      within(section()).getByText('Você ainda não cadastrou o tema do TCC.'),
    ).toBeVisible();
    expect(field()).toHaveValue('');
    expect(field()).not.toHaveAttribute('readonly');
    expect(saveButton()).toBeDisabled();
  });

  it('com tema mostra o texto no campo e a data da última alteração', async () => {
    setup({ topic: { description: VALID, updated_at: SAVED_AT } });
    await ready();

    expect(field()).toHaveValue(VALID);
    expect(
      within(section()).getByText(
        'Última alteração em 9 de novembro de 2026, às 09:00',
      ),
    ).toBeVisible();
    expect(saveButton()).toBeDisabled();
  });

  it('sem orientação e sem tema não mostra o campo: só o motivo e o caminho para buscar orientadores', async () => {
    setup({ advising: false });
    await screen.findByLabelText('Nome completo');
    const tema = await screen.findByRole('region', { name: 'Tema do TCC' });

    expect(await within(tema).findByText(NO_ADVISING)).toBeVisible();
    expect(
      within(tema).queryByRole('textbox', { name: /Tema do TCC/ }),
    ).not.toBeInTheDocument();
    expect(within(tema).queryByText(/\/1000/)).not.toBeInTheDocument();
    expect(
      within(tema).getByRole('link', { name: 'Buscar orientadores' }),
    ).toHaveAttribute('href', '/aluno/orientadores');
    expect(
      within(tema).queryByRole('button', { name: 'Salvar tema' }),
    ).not.toBeInTheDocument();
    // A frase de apoio da seção muda para explicar o caminho, sem mandar "informar" o tema.
    expect(
      within(tema).queryByText(/Informe o tema do seu Trabalho/),
    ).not.toBeInTheDocument();
    expect(
      within(tema).getByText(/depois que um professor aceita sua solicitação/),
    ).toBeVisible();
  });

  it('sem orientação, mas com tema congelado, mostra o texto bloqueado com o motivo ligado ao campo', async () => {
    setup({
      advising: false,
      topic: { description: VALID, updated_at: SAVED_AT },
    });
    await ready();

    expect(field()).toHaveValue(VALID);
    expect(field()).toHaveAttribute('readonly');
    expect(field()).toHaveAccessibleDescription(NO_ADVISING);
    expect(
      within(section()).queryByRole('button', { name: 'Salvar tema' }),
    ).not.toBeInTheDocument();
    expect(
      within(section()).queryByRole('link', { name: 'Buscar orientadores' }),
    ).not.toBeInTheDocument();
  });

  it('só habilita Salvar tema com 10 a 1000 caracteres, sem contar as pontas, e conta os caracteres', async () => {
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
  });

  it('depois de salvar o tema, o foco volta ao campo e não se perde no botão desabilitado', async () => {
    const { events } = setup();
    await ready();
    await events.type(field(), VALID);

    await events.click(saveButton());
    await screen.findByText('Tema salvo.');

    await waitFor(() => expect(field()).toHaveFocus());
  });

  it('grava o tema aparado por conta própria, sem enviar o perfil', async () => {
    const { fetchMock, events } = setup();
    await ready();
    await events.type(field(), `   ${VALID}   `);

    await events.click(saveButton());

    expect(await screen.findByText('Tema salvo.')).toBeVisible();
    expect(
      requestsTo(fetchMock, PUT).map(([, init]) =>
        JSON.parse(String(init?.body)),
      ),
    ).toEqual([{ description: VALID }]);
    expect(requestsTo(fetchMock, PATCH)).toHaveLength(0);
    expect(
      within(section()).getByText(
        'Última alteração em 9 de novembro de 2026, às 09:00',
      ),
    ).toBeVisible();
    expect(saveButton()).toBeDisabled();
    // O resto do perfil não foi tocado: nada de barra de salvar.
    expect(
      screen.queryByRole('button', { name: 'Salvar alterações' }),
    ).not.toBeInTheDocument();
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

  it('um 409 com a tela aberta mostra o encerramento, mantém o texto sem edição e tira o botão', async () => {
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
    mockApi({ ...studentProfileRoutes(), ...server.routes });
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
    expect(field()).toHaveValue('Um tema novo para o meu TCC');
    expect(field()).toHaveAttribute('readonly');
    expect(
      within(section()).queryByRole('button', { name: 'Salvar tema' }),
    ).not.toBeInTheDocument();
  });

  it('abrir o perfil em #tema leva o foco ao título da seção', async () => {
    setup({ path: `${PATH}#tema` });
    await ready();

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Tema do TCC', level: 2 }),
      ).toHaveFocus(),
    );
  });
});

describe('Perfil do aluno: tema e alterações não salvas (RNF28)', () => {
  it('mostra uma frase discreta abaixo do campo enquanto o tema tem alteração, e a tira depois de salvar', async () => {
    const { events } = setup();
    await ready();
    const hint = 'Tema não salvo: use o botão Salvar tema.';
    expect(screen.queryByText(hint)).not.toBeInTheDocument();

    await events.type(field(), VALID);

    expect(await within(section()).findByText(hint)).toBeVisible();
    // Um aviso por vez: não há o alerta amarelo do topo da seção nem a barra do perfil.
    expect(
      screen.queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();
    await events.click(saveButton());
    await screen.findByText('Tema salvo.');
    await waitFor(() =>
      expect(screen.queryByText(hint)).not.toBeInTheDocument(),
    );
  });

  it('com o perfil e o tema alterados, a barra avisa que o tema grava à parte', async () => {
    const { events } = setup();
    await ready();
    await events.type(screen.getByLabelText('Nome completo'), ' Lima');
    expect(
      screen.queryByText(/só são gravadas com o botão Salvar tema/),
    ).not.toBeInTheDocument();

    await events.type(field(), VALID);

    expect(
      await screen.findByText(
        'O tema tem alterações que só são gravadas com o botão Salvar tema.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Salvar alterações' }),
    ).toBeEnabled();
  });

  it('sair pelo menu com o tema alterado pede confirmação, e continuar editando mantém o texto', async () => {
    const { events } = setup();
    await ready();
    await events.type(field(), VALID);

    await events.click(screen.getByRole('link', { name: 'Início' }));

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
  });

  it('sem alteração no tema sai direto', async () => {
    const { events } = setup();
    await ready();

    await events.click(screen.getByRole('link', { name: 'Início' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/aluno/dashboard',
      ),
    );
  });
});
