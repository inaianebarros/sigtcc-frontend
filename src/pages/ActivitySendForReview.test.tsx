import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { mockUploads } from '../test/mockUpload';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const STATUS = 'PATCH /api/atividades/:id/status';
const REASON = 'Entregue ao menos um arquivo para enviar para revisão';
const AWAITING =
  'Aguardando a revisão do orientador: você não altera o status agora';

const DELIVERED = {
  id: 1,
  submitted_at: '2026-11-05T12:00:00Z',
  files: [
    {
      id: 11,
      file_name: 'capitulo2.pdf',
      size_bytes: 1536,
      content_type: 'application/pdf',
    },
  ],
};

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
  mockUploads({
    'POST /api/atividades/5/entregas': (request) => {
      server.activities()[0]!.submissions.push({
        ...DELIVERED,
        files: request.files.map((file, index) => ({
          id: 400 + index,
          file_name: file.name,
          size_bytes: file.size,
          content_type: file.type,
        })),
      });
      return { status: 201, body: {} };
    },
  });
  const events = userEvent.setup({ applyAccept: false });
  renderApp(
    user === 'student' ? '/aluno/atividades/5' : '/professor/atividades/5',
  );
  return { fetchMock, events, server };
}

const sendButton = () =>
  screen.findByRole('button', { name: 'Enviar para revisão' });

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

async function confirmDialog() {
  return screen.findByRole('dialog', { name: 'Enviar para revisão?' });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Enviar para revisão: quando o botão vale', () => {
  it.each(['pending', 'in_progress'] as const)(
    'sem nenhuma Entrega a atividade %s fica desabilitada, com o motivo à vista',
    async (status) => {
      setup({ status });

      const button = await sendButton();

      expect(button).toBeDisabled();
      expect(screen.getByText(REASON)).toBeVisible();
      expect(button).toHaveAccessibleDescription(REASON);
    },
  );

  it.each(['pending', 'in_progress'] as const)(
    'com ao menos uma Entrega a atividade %s habilita o botão, sem o motivo',
    async (status) => {
      setup({ status, submissions: [DELIVERED] });

      expect(await sendButton()).toBeEnabled();
      expect(screen.queryByText(REASON)).not.toBeInTheDocument();
    },
  );

  it('é um botão separado de Entregar arquivos', async () => {
    setup({ submissions: [DELIVERED] });

    expect(await sendButton()).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Entregar arquivos' }),
    ).toBeVisible();
  });

  it.each(['in_review', 'completed'] as const)(
    'não existe com a atividade %s',
    async (status) => {
      setup({ status, submissions: [DELIVERED] });

      await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

      expect(
        screen.queryByRole('button', { name: 'Enviar para revisão' }),
      ).not.toBeInTheDocument();
    },
  );

  it('o professor não o vê', async () => {
    setup({ submissions: [DELIVERED] }, 'teacher');

    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

    expect(
      screen.queryByRole('button', { name: 'Enviar para revisão' }),
    ).not.toBeInTheDocument();
  });

  it('entregar o primeiro arquivo libera o envio para revisão', async () => {
    const { events } = setup();
    expect(await sendButton()).toBeDisabled();
    await events.click(
      screen.getByRole('button', { name: 'Entregar arquivos' }),
    );
    const delivery = await screen.findByRole('dialog', {
      name: 'Entregar arquivos',
    });
    await events.upload(within(delivery).getByLabelText(/Escolher arquivos/), [
      new File(['conteúdo'], 'novo.pdf', { type: 'application/pdf' }),
    ]);

    await events.click(
      within(delivery).getByRole('button', { name: 'Entregar' }),
    );

    await screen.findByText('Entrega enviada.');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Enviar para revisão' }),
      ).toBeEnabled(),
    );
    expect(screen.queryByText(REASON)).not.toBeInTheDocument();
  });
});

describe('Enviar para revisão: a confirmação (RNF21)', () => {
  it('pede confirmação explicando a perda de controle e não envia ao cancelar', async () => {
    const { fetchMock, events } = setup({ submissions: [DELIVERED] });

    await events.click(await sendButton());

    const dialog = await confirmDialog();
    expect(
      within(dialog).getByText(
        /deixará de poder alterar o status da atividade até o orientador revisá-la/,
      ),
    ).toBeVisible();
    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(statusBodies(fetchMock)).toEqual([]);
  });

  it('confirmar envia in_review, avisa, e o controle é trocado pelo aviso de aguardando', async () => {
    const { fetchMock, events } = setup({
      status: 'in_progress',
      submissions: [DELIVERED],
    });
    await events.click(await sendButton());
    const dialog = await confirmDialog();

    await events.click(
      within(dialog).getByRole('button', { name: 'Enviar para revisão' }),
    );

    expect(
      await screen.findByText('Atividade enviada para revisão.'),
    ).toBeVisible();
    expect(statusBodies(fetchMock)).toEqual([{ status: 'in_review' }]);
    expect(await screen.findByText(AWAITING)).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Em revisão')).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Status da atividade' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Enviar para revisão' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Entregar arquivos' }),
    ).not.toBeInTheDocument();
  });

  it('trava a confirmação enquanto envia e faz um pedido só', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup(
      { submissions: [DELIVERED] },
      'student',
      {
        [STATUS]: async () => {
          await gate;
          return { body: makeActivity(5, { status: 'in_review' }) };
        },
      },
    );
    await events.click(await sendButton());
    const dialog = await confirmDialog();

    await events.click(
      within(dialog).getByRole('button', { name: 'Enviar para revisão' }),
    );

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Cancelar' }),
      ).toBeDisabled(),
    );
    release();
    await screen.findByText('Atividade enviada para revisão.');
    expect(statusBodies(fetchMock)).toHaveLength(1);
  });
});

describe('Enviar para revisão: depois de uma recusa', () => {
  it('as Entregas anteriores continuam e o aluno reenvia sem Entrega nova', async () => {
    const { fetchMock, events } = setup({
      status: 'pending',
      submissions: [DELIVERED],
      reviews: [
        { id: 1, decision: 'rejected', decided_at: '2026-11-06T10:00:00Z' },
      ],
    });

    const section = await screen.findByRole('region', {
      name: 'Linha do tempo',
    });
    expect(await within(section).findByText('capitulo2.pdf')).toBeVisible();
    await events.click(await sendButton());
    await events.click(
      within(await confirmDialog()).getByRole('button', {
        name: 'Enviar para revisão',
      }),
    );

    expect(
      await screen.findByText('Atividade enviada para revisão.'),
    ).toBeVisible();
    expect(statusBodies(fetchMock)).toEqual([{ status: 'in_review' }]);
    expect(requestsTo(fetchMock, 'POST /api/atividades/5/entregas')).toEqual(
      [],
    );
  });
});

describe('Enviar para revisão: erros', () => {
  it('um 409 fecha a confirmação, mostra a mensagem do servidor e recarrega o detalhe', async () => {
    const { fetchMock, events } = setup(
      { submissions: [DELIVERED] },
      'student',
      {
        [STATUS]: {
          status: 409,
          body: {
            detail:
              'Esta atividade está em revisão e só o orientador pode alterar o status.',
          },
        },
      },
    );
    await events.click(await sendButton());
    const reads = requestsTo(fetchMock, 'GET /api/atividades/5').length;

    await events.click(
      within(await confirmDialog()).getByRole('button', {
        name: 'Enviar para revisão',
      }),
    );

    expect(
      await screen.findByText(
        'Esta atividade está em revisão e só o orientador pode alterar o status.',
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        requestsTo(fetchMock, 'GET /api/atividades/5').length,
      ).toBeGreaterThan(reads),
    );
  });

  it('um 404 avisa que a orientação foi encerrada e atualiza a sessão', async () => {
    const { fetchMock, events } = setup(
      { submissions: [DELIVERED] },
      'student',
      {
        [STATUS]: {
          status: 404,
          body: { detail: 'Atividade não encontrada.' },
        },
      },
    );
    await events.click(await sendButton());
    const reads = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(
      within(await confirmDialog()).getByRole('button', {
        name: 'Enviar para revisão',
      }),
    );

    expect(
      await screen.findByText('A orientação foi encerrada.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET /api/auth/me').length).toBeGreaterThan(
        reads,
      ),
    );
  });

  it('uma falha do servidor mostra a mensagem, fecha a confirmação e deixa tentar de novo', async () => {
    const { events } = setup({ submissions: [DELIVERED] }, 'student', {
      [STATUS]: { status: 500, body: {} },
    });
    await events.click(await sendButton());

    await events.click(
      within(await confirmDialog()).getByRole('button', {
        name: 'Enviar para revisão',
      }),
    );

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(await sendButton()).toBeEnabled();
  });
});
