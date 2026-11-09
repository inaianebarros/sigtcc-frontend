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

const PATH = '/aluno/atividades/5';
const STATUS = 'PATCH /api/atividades/:id/status';
const ME = 'GET /api/auth/me';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup(
  activity: Partial<FakeActivity> = {},
  user: 'student' | 'teacher' = 'student',
  overrides: Overrides = {},
) {
  const server = activitiesServer([makeActivity(5, activity)], {
    user,
    overrides: overrides as never,
  });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(user === 'student' ? PATH : '/professor/atividades/5');
  return { fetchMock, events, server };
}

const AWAITING =
  'Aguardando a revisão do orientador: você não altera o status agora';

function statusBodies(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === 'PATCH' &&
        new URL(String(input), 'http://localhost').pathname.endsWith('/status'),
    )
    .map(
      ([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>,
    );
}

async function statusGroup() {
  return screen.findByRole('group', { name: 'Status da atividade' });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Status da atividade: o controle do aluno', () => {
  it('mostra Pendente e Em andamento, com o status atual marcado', async () => {
    setup({ status: 'pending' });

    const group = await statusGroup();

    expect(
      within(group).getByRole('button', { name: 'Pendente' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(group).getByRole('button', { name: 'Em andamento' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('muda na hora, sem botão de salvar, avisa e recarrega a atividade', async () => {
    const { fetchMock, events } = setup({ status: 'pending' });
    const group = await statusGroup();

    await events.click(
      within(group).getByRole('button', { name: 'Em andamento' }),
    );

    expect(await screen.findByText('Status atualizado.')).toBeVisible();
    expect(statusBodies(fetchMock)).toEqual([{ status: 'in_progress' }]);
    await waitFor(() =>
      expect(
        within(
          screen.getByRole('group', { name: 'Status da atividade' }),
        ).getByRole('button', { name: 'Em andamento' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(
      screen.queryByRole('button', { name: /Salvar/ }),
    ).not.toBeInTheDocument();
  });

  it('volta de Em andamento para Pendente, quantas vezes quiser', async () => {
    const { fetchMock, events } = setup({ status: 'in_progress' });
    let group = await statusGroup();

    await events.click(within(group).getByRole('button', { name: 'Pendente' }));
    await waitFor(() => expect(statusBodies(fetchMock)).toHaveLength(1));
    group = await statusGroup();
    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Pendente' }),
      ).toBeEnabled(),
    );
    await events.click(
      within(group).getByRole('button', { name: 'Em andamento' }),
    );

    await waitFor(() =>
      expect(statusBodies(fetchMock)).toEqual([
        { status: 'pending' },
        { status: 'in_progress' },
      ]),
    );
  });

  it('clicar no status que já está marcado não faz pedido', async () => {
    const { fetchMock, events } = setup({ status: 'pending' });
    const group = await statusGroup();

    await events.click(within(group).getByRole('button', { name: 'Pendente' }));

    expect(statusBodies(fetchMock)).toEqual([]);
  });

  it('desabilita os dois botões durante o pedido e envia uma vez só', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup({ status: 'pending' }, 'student', {
      [STATUS]: async () => {
        await gate;
        return { body: makeActivity(5, { status: 'in_progress' }) };
      },
    });
    const group = await statusGroup();

    await events.click(
      within(group).getByRole('button', { name: 'Em andamento' }),
    );

    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Pendente' }),
      ).toBeDisabled(),
    );
    expect(
      within(group).getByRole('button', { name: 'Em andamento' }),
    ).toBeDisabled();
    release();
    await screen.findByText('Status atualizado.');
    expect(statusBodies(fetchMock)).toHaveLength(1);
  });

  it('em revisão o controle some e aparece o aviso de aguardando', async () => {
    setup({ status: 'in_review' });

    expect(await screen.findByText(AWAITING)).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Status da atividade' }),
    ).not.toBeInTheDocument();
  });

  it('concluída o controle some e aparece "Atividade concluída"', async () => {
    setup({ status: 'completed' });

    const section = (
      await screen.findByRole('heading', { name: 'Status e entrega' })
    ).closest('section')!;

    expect(within(section).getByText('Atividade concluída')).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Status da atividade' }),
    ).not.toBeInTheDocument();
  });

  it('o professor vê o status, sem o controle nem os avisos do aluno', async () => {
    setup({ status: 'in_review' }, 'teacher');

    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

    expect(screen.getByText('Em revisão')).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Status da atividade' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(AWAITING)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Status e entrega' }),
    ).not.toBeInTheDocument();
  });
});

describe('Status da atividade: erros', () => {
  it('um 409 mostra a mensagem do servidor e recarrega o detalhe', async () => {
    const { fetchMock, events } = setup({ status: 'pending' }, 'student', {
      [STATUS]: {
        status: 409,
        body: {
          detail:
            'Esta atividade está em revisão e só o orientador pode alterar o status.',
        },
      },
    });
    const group = await statusGroup();
    const reads = requestsTo(fetchMock, 'GET /api/atividades/5').length;

    await events.click(
      within(group).getByRole('button', { name: 'Em andamento' }),
    );

    expect(
      await screen.findByText(
        'Esta atividade está em revisão e só o orientador pode alterar o status.',
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        requestsTo(fetchMock, 'GET /api/atividades/5').length,
      ).toBeGreaterThan(reads),
    );
  });

  it('um 404 avisa que a orientação foi encerrada e atualiza a sessão', async () => {
    const { fetchMock, events } = setup({ status: 'pending' }, 'student', {
      [STATUS]: { status: 404, body: { detail: 'Atividade não encontrada.' } },
    });
    const group = await statusGroup();
    const reads = requestsTo(fetchMock, ME).length;

    await events.click(
      within(group).getByRole('button', { name: 'Em andamento' }),
    );

    expect(
      await screen.findByText('A orientação foi encerrada.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, ME).length).toBeGreaterThan(reads),
    );
  });

  it('uma falha do servidor mostra a mensagem e deixa tentar de novo', async () => {
    const { events } = setup({ status: 'pending' }, 'student', {
      [STATUS]: { status: 500, body: {} },
    });
    const group = await statusGroup();

    await events.click(
      within(group).getByRole('button', { name: 'Em andamento' }),
    );

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Em andamento' }),
      ).toBeEnabled(),
    );
  });
});
