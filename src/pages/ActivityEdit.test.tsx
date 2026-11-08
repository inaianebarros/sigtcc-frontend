import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const PATH = '/professor/atividades/5';
const PATCH = 'PATCH /api/atividades/:id';

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

const BASE = makeActivity(5, {
  title: 'Capítulo 2',
  description: 'Entregar o capítulo 2',
  deadline: '2099-12-31',
});

function setup({
  activity = BASE as FakeActivity,
  overrides = {} as Overrides,
} = {}) {
  const server = activitiesServer([activity], {
    user: 'teacher',
    overrides: overrides as never,
  });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(PATH);
  return { fetchMock, events, server };
}

function patchBodies(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([input, init]) => {
      return (
        init?.method === 'PATCH' &&
        new URL(String(input), 'http://localhost').pathname.startsWith(
          '/api/atividades/',
        )
      );
    })
    .map(
      ([, init]) => JSON.parse(String(init?.body)) as Record<string, string>,
    );
}

async function openDialog(events: ReturnType<typeof userEvent.setup>) {
  await events.click(await screen.findByRole('button', { name: 'Editar' }));
  return screen.findByRole('dialog', { name: 'Editar atividade' });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Editar atividade: o envio', () => {
  it('abre com os dados da atividade, sem o campo do aluno', async () => {
    const { events } = setup();

    const dialog = await openDialog(events);

    expect(within(dialog).getByLabelText(/Título/)).toHaveValue('Capítulo 2');
    expect(within(dialog).getByLabelText(/Descrição/)).toHaveValue(
      'Entregar o capítulo 2',
    );
    expect(within(dialog).getByLabelText(/Prazo/)).toHaveValue('2099-12-31');
    expect(
      within(dialog).queryByRole('combobox', { name: 'Aluno' }),
    ).not.toBeInTheDocument();
  });

  it('envia só o que mudou, aparado, fecha o diálogo, avisa e mostra o novo título no detalhe', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openDialog(events);
    const title = within(dialog).getByLabelText(/Título/);
    await events.clear(title);
    await events.type(title, '  Capítulo 3  ');

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Editar atividade' }),
      ).not.toBeInTheDocument(),
    );
    expect(patchBodies(fetchMock)).toEqual([{ title: 'Capítulo 3' }]);
    expect(await screen.findByText('Atividade atualizada.')).toBeVisible();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Capítulo 3' }),
    ).toBeVisible();
  });

  it('muda o prazo e a descrição juntos', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openDialog(events);
    const description = within(dialog).getByLabelText(/Descrição/);
    await events.clear(description);
    await events.type(description, 'Nova descrição');
    const deadline = within(dialog).getByLabelText(/Prazo/);
    await events.clear(deadline);
    await events.type(deadline, '2100-01-15');

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(patchBodies(fetchMock)).toEqual([
        { description: 'Nova descrição', deadline: '2100-01-15' },
      ]),
    );
  });

  it('sem nada alterado não envia nada: fecha e diz que não havia o que salvar', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openDialog(events);

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Nenhuma alteração para salvar.'),
    ).toBeVisible();
    expect(patchBodies(fetchMock)).toHaveLength(0);
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Editar atividade' }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('Editar atividade: o prazo só é validado quando muda', () => {
  const LATE = makeActivity(5, {
    title: 'Atrasada',
    description: 'Texto',
    deadline: '2020-01-10',
    overdue: true,
  });

  it('o título de uma atividade atrasada pode ser corrigido sem mexer no prazo antigo', async () => {
    const { fetchMock, events } = setup({ activity: LATE });
    const dialog = await openDialog(events);
    const title = within(dialog).getByLabelText(/Título/);
    await events.clear(title);
    await events.type(title, 'Corrigida');

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(patchBodies(fetchMock)).toEqual([{ title: 'Corrigida' }]),
    );
  });

  it('um prazo novo no passado é recusado, e o de hoje é aceito', async () => {
    const { fetchMock, events } = setup({ activity: LATE });
    const dialog = await openDialog(events);
    const deadline = within(dialog).getByLabelText(/Prazo/);
    await events.clear(deadline);
    await events.type(deadline, localToday(-1));

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      await within(dialog).findByText('O prazo não pode ser anterior a hoje.'),
    ).toBeVisible();
    expect(patchBodies(fetchMock)).toHaveLength(0);

    await events.clear(deadline);
    await events.type(deadline, localToday());
    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(patchBodies(fetchMock)).toEqual([{ deadline: localToday() }]),
    );
  });
});

describe('Editar atividade: erros e alterações não salvas (RNF28)', () => {
  it('leva os erros do servidor aos campos e mantém o diálogo aberto', async () => {
    const { events } = setup({
      overrides: {
        [PATCH]: {
          status: 422,
          body: {
            detail: [
              {
                loc: ['body', 'payload', 'title'],
                msg: 'Título recusado pelo servidor.',
                type: 'value_error',
              },
            ],
          },
        },
      },
    });
    const dialog = await openDialog(events);
    await events.type(within(dialog).getByLabelText(/Título/), ' novo');

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      await within(dialog).findByText('Título recusado pelo servidor.'),
    ).toBeVisible();
    expect(
      screen.getByRole('dialog', { name: 'Editar atividade' }),
    ).toBeVisible();
  });

  it('um 409 mostra a mensagem do servidor, fecha o diálogo e atualiza o detalhe', async () => {
    const { fetchMock, events } = setup({
      overrides: {
        [PATCH]: {
          status: 409,
          body: {
            detail: 'Esta atividade já foi concluída e não pode ser alterada.',
          },
        },
      },
    });
    const dialog = await openDialog(events);
    await events.type(within(dialog).getByLabelText(/Título/), ' novo');
    const reads = requestsTo(fetchMock, 'GET /api/atividades/:id').length;

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText(
        'Esta atividade já foi concluída e não pode ser alterada.',
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Editar atividade' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([input, init]) =>
            (init?.method ?? 'GET') === 'GET' &&
            String(input).endsWith('/atividades/5'),
        ).length,
      ).toBeGreaterThan(reads - 1),
    );
  });

  it('um 404 diz que a orientação foi encerrada e atualiza a sessão', async () => {
    const { fetchMock, events } = setup({
      overrides: {
        [PATCH]: { status: 404, body: { detail: 'Atividade não encontrada.' } },
      },
    });
    const dialog = await openDialog(events);
    await events.type(within(dialog).getByLabelText(/Título/), ' novo');
    const meBefore = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('A orientação foi encerrada.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET /api/auth/me').length).toBeGreaterThan(
        meBefore,
      ),
    );
  });

  it('sem alteração, Cancelar fecha direto, sem pedir confirmação', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Editar atividade' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
    ).not.toBeInTheDocument();
  });

  it('com alteração mostra o aviso no topo e pede confirmação antes de fechar', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);
    await events.type(within(dialog).getByLabelText(/Título/), ' novo');

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
    expect(within(dialog).getByLabelText(/Título/)).toHaveValue(
      'Capítulo 2 novo',
    );
  });
});
