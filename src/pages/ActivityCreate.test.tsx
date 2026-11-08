import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { makeAdvisee } from '../test/adviseesApi';
import type { FakeAdvisee } from '../test/adviseesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const PATH = '/professor/atividades';
const CREATE = 'POST /api/atividades';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function localToday(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function setup({
  activities = [] as FakeActivity[],
  advisees = [makeAdvisee(1), makeAdvisee(2)] as FakeAdvisee[],
  path = PATH,
  overrides = {} as Overrides,
} = {}) {
  const server = activitiesServer(activities, {
    user: 'teacher',
    advisees,
    overrides: overrides as never,
  });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(path);
  return { fetchMock, events, server };
}

async function openDialog(events: ReturnType<typeof userEvent.setup>) {
  await events.click(
    await screen.findByRole('button', { name: 'Nova atividade' }),
  );
  return screen.findByRole('dialog', { name: 'Nova atividade' });
}

async function chooseStudent(
  events: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  name: string,
) {
  await events.click(within(dialog).getByRole('combobox', { name: 'Aluno' }));
  await events.click(await screen.findByRole('option', { name }));
}

async function fill(
  events: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  values: { title?: string; description?: string; deadline?: string },
) {
  if (values.title !== undefined) {
    await events.type(within(dialog).getByLabelText(/Título/), values.title);
  }
  if (values.description !== undefined) {
    await events.type(
      within(dialog).getByLabelText(/Descrição/),
      values.description,
    );
  }
  if (values.deadline !== undefined) {
    await events.type(within(dialog).getByLabelText(/Prazo/), values.deadline);
  }
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Nova atividade: o envio', () => {
  it('cria a atividade com os campos aparados, fecha o diálogo, avisa e mostra a nova atividade na lista', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openDialog(events);

    await chooseStudent(events, dialog, 'Orientando 2');
    await fill(events, dialog, {
      title: '  Capítulo 2  ',
      description: '  Entregar o capítulo 2  ',
      deadline: '2099-12-31',
    });
    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Nova atividade' }),
      ).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, CREATE)).toHaveLength(1);
    const [, init] = requestsTo(fetchMock, CREATE)[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      student_id: 102,
      title: 'Capítulo 2',
      description: 'Entregar o capítulo 2',
      deadline: '2099-12-31',
    });
    expect(await screen.findByText('Atividade criada.')).toBeVisible();
    expect(await screen.findByText('Capítulo 2')).toBeVisible();
  });

  it('mostra o andamento e não deixa enviar de novo enquanto o pedido está em curso', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup({
      overrides: {
        [CREATE]: async () => {
          await gate;
          return { status: 201, body: makeActivity(9) };
        },
      },
    });
    const dialog = await openDialog(events);
    await chooseStudent(events, dialog, 'Orientando 1');
    await fill(events, dialog, {
      title: 'Capítulo',
      description: 'Texto',
      deadline: '2099-12-31',
    });

    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    const busy = await within(dialog).findByRole('button', {
      name: 'Criando…',
    });
    expect(busy).toBeDisabled();
    release();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Nova atividade' }),
      ).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, CREATE)).toHaveLength(1);
  });
});

describe('Nova atividade: validação', () => {
  it('mostra o erro de cada campo vazio e não envia nada', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openDialog(events);

    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    expect(await within(dialog).findByText('Escolha o aluno.')).toBeVisible();
    expect(within(dialog).getByText('Informe o título.')).toBeVisible();
    expect(within(dialog).getByText('Informe a descrição.')).toBeVisible();
    expect(within(dialog).getByText('Informe o prazo.')).toBeVisible();
    expect(requestsTo(fetchMock, CREATE)).toHaveLength(0);
  });

  it('recusa título e descrição só com espaços e acima dos limites', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openDialog(events);
    await chooseStudent(events, dialog, 'Orientando 1');
    await fill(events, dialog, { title: '   ', description: '   ' });
    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    expect(await within(dialog).findByText('Informe o título.')).toBeVisible();
    expect(within(dialog).getByText('Informe a descrição.')).toBeVisible();

    const title = within(dialog).getByLabelText(/Título/);
    await events.clear(title);
    await events.click(title);
    await events.paste('x'.repeat(201));
    const description = within(dialog).getByLabelText(/Descrição/);
    await events.clear(description);
    await events.click(description);
    await events.paste('y'.repeat(2001));
    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    expect(
      await within(dialog).findByText(
        'O título deve ter no máximo 200 caracteres.',
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        'A descrição deve ter no máximo 2000 caracteres.',
      ),
    ).toBeVisible();
    expect(requestsTo(fetchMock, CREATE)).toHaveLength(0);
  });

  it('recusa um prazo anterior a hoje e aceita o de hoje', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openDialog(events);
    await chooseStudent(events, dialog, 'Orientando 1');
    await fill(events, dialog, {
      title: 'Capítulo',
      description: 'Texto',
      deadline: localToday(-1),
    });
    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    expect(
      await within(dialog).findByText('O prazo não pode ser anterior a hoje.'),
    ).toBeVisible();
    expect(requestsTo(fetchMock, CREATE)).toHaveLength(0);

    const deadline = within(dialog).getByLabelText(/Prazo/);
    await events.clear(deadline);
    await events.type(deadline, localToday());
    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    await waitFor(() => expect(requestsTo(fetchMock, CREATE)).toHaveLength(1));
  });

  it('leva os erros do servidor aos campos e mantém o diálogo aberto com o que foi digitado', async () => {
    const { events } = setup({
      overrides: {
        [CREATE]: {
          status: 422,
          body: {
            detail: [
              {
                loc: ['body', 'payload', 'deadline'],
                msg: 'O prazo não pode ser anterior a hoje.',
                type: 'value_error',
              },
            ],
          },
        },
      },
    });
    const dialog = await openDialog(events);
    await chooseStudent(events, dialog, 'Orientando 1');
    await fill(events, dialog, {
      title: 'Capítulo',
      description: 'Texto',
      deadline: '2099-12-31',
    });
    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    expect(
      await within(dialog).findByText('O prazo não pode ser anterior a hoje.'),
    ).toBeVisible();
    expect(within(dialog).getByLabelText(/Título/)).toHaveValue('Capítulo');
    expect(
      screen.getByRole('dialog', { name: 'Nova atividade' }),
    ).toBeVisible();
  });
});

describe('Nova atividade: a seleção do aluno', () => {
  it('chega já preenchida quando a lista foi aberta pelo cartão do orientando', async () => {
    const { fetchMock, events } = setup({
      path: '/professor/atividades?aluno=102',
    });
    const dialog = await openDialog(events);

    expect(within(dialog).getByRole('combobox', { name: 'Aluno' })).toHaveValue(
      'Orientando 2',
    );
    await fill(events, dialog, {
      title: 'Capítulo',
      description: 'Texto',
      deadline: '2099-12-31',
    });
    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    await waitFor(() => expect(requestsTo(fetchMock, CREATE)).toHaveLength(1));
    const [, init] = requestsTo(fetchMock, CREATE)[0]!;
    expect(JSON.parse(String(init?.body)).student_id).toBe(102);
  });

  it('carrega os orientandos por páginas e oferece Carregar mais enquanto houver', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      makeAdvisee(index + 1),
    );
    const { fetchMock, events } = setup({ advisees: many });
    const dialog = await openDialog(events);

    await events.click(within(dialog).getByRole('combobox', { name: 'Aluno' }));
    expect(
      await screen.findByRole('option', { name: 'Orientando 1' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('option', { name: 'Orientando 21' }),
    ).not.toBeInTheDocument();

    await events.click(
      screen.getByRole('button', { name: 'Carregar mais orientandos' }),
    );

    expect(
      await screen.findByRole('option', { name: 'Orientando 21' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Carregar mais orientandos' }),
    ).not.toBeInTheDocument();
    const offsets = requestsTo(
      fetchMock,
      'GET /api/orientacao/orientandos',
    ).map(([input]) =>
      new URL(String(input), 'http://localhost').searchParams.get('offset'),
    );
    expect(offsets).toContain('20');
  });
});

describe('Nova atividade: orientação encerrada e alterações não salvas (RNF28)', () => {
  it('um 404 diz que a orientação foi encerrada, atualiza a sessão e fecha o diálogo', async () => {
    const { fetchMock, events } = setup({
      overrides: {
        [CREATE]: { status: 404, body: { detail: 'Aluno não encontrado.' } },
      },
    });
    const dialog = await openDialog(events);
    await chooseStudent(events, dialog, 'Orientando 1');
    await fill(events, dialog, {
      title: 'Capítulo',
      description: 'Texto',
      deadline: '2099-12-31',
    });
    const meBefore = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(within(dialog).getByRole('button', { name: 'Criar' }));

    expect(
      await screen.findByText('A orientação foi encerrada.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Nova atividade' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET /api/auth/me').length).toBeGreaterThan(
        meBefore,
      ),
    );
  });

  it('com conteúdo digitado mostra o aviso no topo e pede confirmação antes de fechar', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();

    await fill(events, dialog, { title: 'Rascunho' });

    expect(
      await within(dialog).findByText(/Você tem alterações não salvas/),
    ).toBeVisible();
    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );

    const confirm = await screen.findByRole('dialog', {
      name: 'Descartar alterações?',
    });
    await events.click(
      within(confirm).getByRole('button', { name: 'Continuar editando' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
      ).not.toBeInTheDocument(),
    );
    expect(within(dialog).getByLabelText(/Título/)).toHaveValue('Rascunho');

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    await events.click(
      await screen.findByRole('button', { name: 'Sair sem salvar' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Nova atividade' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('sem nada digitado, Cancelar fecha direto, e o aluno vindo do cartão não conta como alteração', async () => {
    const { events } = setup({ path: '/professor/atividades?aluno=101' });
    const dialog = await openDialog(events);
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Nova atividade' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
    ).not.toBeInTheDocument();
  });

  it('reabrir o diálogo depois de descartar começa com os campos vazios', async () => {
    const { events } = setup();
    let dialog = await openDialog(events);
    await fill(events, dialog, { title: 'Rascunho' });
    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    await events.click(
      await screen.findByRole('button', { name: 'Sair sem salvar' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Nova atividade' }),
      ).not.toBeInTheDocument(),
    );

    dialog = await openDialog(events);

    expect(within(dialog).getByLabelText(/Título/)).toHaveValue('');
  });

  it('sair da tela por um link do menu com conteúdo digitado pede confirmação, e continuar editando mantém tudo', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);
    await fill(events, dialog, { title: 'Rascunho' });

    // Com o diálogo aberto o menu fica fora da árvore de acessibilidade, mas o link existe.
    await events.click(
      screen.getByRole('link', { name: 'Meu perfil', hidden: true }),
    );

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
    expect(screen.getByTestId('location')).toHaveTextContent(PATH);
    expect(within(dialog).getByLabelText(/Título/)).toHaveValue('Rascunho');

    await events.click(
      screen.getByRole('link', { name: 'Meu perfil', hidden: true }),
    );
    await events.click(
      await screen.findByRole('button', { name: 'Sair sem salvar' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/professor/perfil',
      ),
    );
  });
});
