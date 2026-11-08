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
const DELETE = 'DELETE /api/atividades/:id';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup({
  activities = [
    makeActivity(5, { title: 'Capítulo 2', status: 'in_progress' }),
    makeActivity(6, { title: 'Outra atividade' }),
  ] as FakeActivity[],
  overrides = {} as Overrides,
  from,
}: { activities?: FakeActivity[]; overrides?: Overrides; from?: string } = {}) {
  const server = activitiesServer(activities, {
    user: 'teacher',
    overrides: overrides as never,
  });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(
    PATH,
    from ? { entries: [{ pathname: PATH, state: { from } }] } : undefined,
  );
  return { fetchMock, events, server };
}

function deleteRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');
}

async function askToDelete(events: ReturnType<typeof userEvent.setup>) {
  await events.click(await screen.findByRole('button', { name: 'Excluir' }));
  return screen.findByRole('dialog', { name: 'Excluir a atividade?' });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Excluir atividade: a confirmação (RNF21)', () => {
  it('pede confirmação explícita, diz que a atividade deixa de ser exibida e que entregas, comentários e revisões são preservados', async () => {
    const { fetchMock, events } = setup();

    const dialog = await askToDelete(events);

    expect(within(dialog).getByText(/Capítulo 2/)).toBeVisible();
    expect(within(dialog).getByText(/deixará de ser exibida/)).toBeVisible();
    expect(
      within(dialog).getByText(/entregas, os comentários e as revisões/),
    ).toBeVisible();
    expect(within(dialog).getByText(/não pode ser desfeita/)).toBeVisible();
    expect(deleteRequests(fetchMock)).toHaveLength(0);
  });

  it('Cancelar fecha a confirmação sem excluir', async () => {
    const { fetchMock, events } = setup();
    const dialog = await askToDelete(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Excluir a atividade?' }),
      ).not.toBeInTheDocument(),
    );
    expect(deleteRequests(fetchMock)).toHaveLength(0);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Capítulo 2' }),
    ).toBeVisible();
  });
});

describe('Excluir atividade: o resultado', () => {
  it('exclui, avisa e volta à lista com a página e os filtros de antes, sem a atividade', async () => {
    const { fetchMock, events } = setup({
      from: '/professor/atividades?situacao=in_progress',
    });
    const dialog = await askToDelete(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Excluir atividade' }),
    );

    expect(await screen.findByText('Atividade excluída.')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/professor/atividades?situacao=in_progress',
      ),
    );
    expect(deleteRequests(fetchMock)).toHaveLength(1);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Atividades' }),
    ).toBeVisible();
    expect(screen.queryByText('Capítulo 2')).not.toBeInTheDocument();
  });

  it('sem origem, volta à lista do professor', async () => {
    const { events } = setup();
    const dialog = await askToDelete(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Excluir atividade' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        /^\/professor\/atividades$/,
      ),
    );
    expect(await screen.findByText('Outra atividade')).toBeVisible();
  });

  it('mostra o andamento e não deixa confirmar de novo enquanto o pedido está em curso', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup({
      overrides: {
        [DELETE]: async () => {
          await gate;
          return { status: 204 };
        },
      },
    });
    const dialog = await askToDelete(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Excluir atividade' }),
    );

    const busy = await within(dialog).findByRole('button', {
      name: 'Excluindo…',
    });
    expect(busy).toBeDisabled();
    release();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        /\/professor\/atividades$/,
      ),
    );
    expect(deleteRequests(fetchMock)).toHaveLength(1);
  });
});

describe('Excluir atividade: falhas', () => {
  it('um 409 mostra a mensagem do servidor, fecha a confirmação e atualiza o detalhe', async () => {
    const { events } = setup({
      overrides: {
        [DELETE]: {
          status: 409,
          body: {
            detail: 'Esta atividade já foi concluída e não pode ser alterada.',
          },
        },
      },
    });
    const dialog = await askToDelete(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Excluir atividade' }),
    );

    expect(
      await screen.findByText(
        'Esta atividade já foi concluída e não pode ser alterada.',
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Excluir a atividade?' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('location')).toHaveTextContent(PATH);
  });

  it('um 404 diz que a orientação foi encerrada e atualiza a sessão', async () => {
    const { fetchMock, events } = setup({
      overrides: {
        [DELETE]: {
          status: 404,
          body: { detail: 'Atividade não encontrada.' },
        },
      },
    });
    const dialog = await askToDelete(events);
    const meBefore = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(
      within(dialog).getByRole('button', { name: 'Excluir atividade' }),
    );

    expect(
      await screen.findByText('A orientação foi encerrada.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET /api/auth/me').length).toBeGreaterThan(
        meBefore,
      ),
    );
  });

  it('uma falha do servidor avisa, fecha a confirmação e deixa a atividade onde estava', async () => {
    const { events } = setup({
      overrides: { [DELETE]: { status: 500, body: {} } },
    });
    const dialog = await askToDelete(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Excluir atividade' }),
    );

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Excluir a atividade?' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('location')).toHaveTextContent(PATH);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Capítulo 2' }),
    ).toBeVisible();
  });
});
