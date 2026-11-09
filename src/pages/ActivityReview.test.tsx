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

const REVIEW = 'POST /api/atividades/:id/revisar';
const REVIEW_PATH = 'POST /api/atividades/5/revisar';
const COMPLETED_REASON = 'Atividade concluída não pode ser alterada';

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
  user: 'student' | 'teacher' = 'teacher',
  overrides: Overrides = {},
) {
  const server = activitiesServer(
    [
      makeActivity(5, {
        status: 'in_review',
        submissions: [DELIVERED],
        ...activity,
      }),
    ],
    { user, overrides: overrides as never },
  );
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup({ applyAccept: false });
  renderApp(
    user === 'student' ? '/aluno/atividades/5' : '/professor/atividades/5',
  );
  return { fetchMock, events, server };
}

const panel = () => screen.findByRole('region', { name: 'Revisão' });

function reviewBodies(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, REVIEW_PATH).map(
    ([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>,
  );
}

async function openRefusal(events: ReturnType<typeof userEvent.setup>) {
  await events.click(
    within(await panel()).getByRole('button', { name: 'Recusar' }),
  );
  return screen.findByRole('dialog', { name: 'Recusar a atividade' });
}

async function openAcceptance(events: ReturnType<typeof userEvent.setup>) {
  await events.click(
    within(await panel()).getByRole('button', { name: 'Aceitar' }),
  );
  return screen.findByRole('dialog', { name: 'Aceitar a atividade?' });
}

async function writeJustification(
  events: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  text: string,
) {
  await events.click(within(dialog).getByLabelText(/Justificativa/));
  await events.paste(text);
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Revisão: quando o painel aparece', () => {
  it('o orientador vê "Aguardando a sua revisão" com Aceitar e Recusar enquanto a atividade está em revisão', async () => {
    setup();

    const region = await panel();

    expect(within(region).getByText('Aguardando a sua revisão')).toBeVisible();
    expect(
      within(region).getByRole('button', { name: 'Aceitar' }),
    ).toBeEnabled();
    expect(
      within(region).getByRole('button', { name: 'Recusar' }),
    ).toBeEnabled();
  });

  it('o professor abre o material pela seção Entregas, que já existe', async () => {
    setup();

    const deliveries = await screen.findByRole('region', { name: 'Entregas' });

    expect(within(deliveries).getByText('capitulo2.pdf')).toBeVisible();
  });

  it('o aluno não vê o painel e continua com o aviso de aguardando', async () => {
    setup({}, 'student');

    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

    expect(
      screen.queryByRole('region', { name: 'Revisão' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Aceitar' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(/Aguardando a revisão do orientador/),
    ).toBeVisible();
  });

  it.each(['pending', 'in_progress', 'completed'] as const)(
    'não aparece com a atividade %s',
    async (status) => {
      setup({ status });

      await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

      expect(
        screen.queryByRole('region', { name: 'Revisão' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Aceitar' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Recusar' }),
      ).not.toBeInTheDocument();
    },
  );
});

describe('Revisão: aceitar (RN15, RNF21)', () => {
  it('pede confirmação dizendo que concluir é definitivo e não envia ao cancelar', async () => {
    const { fetchMock, events } = setup();

    const dialog = await openAcceptance(events);

    expect(
      within(dialog).getByText(
        /concluirá a atividade de forma definitiva e não pode ser desfeito/,
      ),
    ).toBeVisible();
    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(reviewBodies(fetchMock)).toEqual([]);
  });

  it('confirmar envia accepted sem justificativa, avisa, conclui e desabilita editar e excluir com o motivo', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openAcceptance(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Aceitar atividade' }),
    );

    expect(await screen.findByText('Atividade concluída')).toBeVisible();
    expect(reviewBodies(fetchMock)).toEqual([{ decision: 'accepted' }]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Concluída')).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Editar' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled();
    expect(
      screen.queryByRole('region', { name: 'Revisão' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(COMPLETED_REASON)).toBeVisible();
    const history = screen.getByRole('region', { name: 'Revisões' });
    expect(within(history).getByText(/Aceita em/)).toBeVisible();
  });

  it('trava a confirmação enquanto envia e faz um pedido só', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup({}, 'teacher', {
      [REVIEW]: async () => {
        await gate;
        return { body: makeActivity(5, { status: 'completed' }) };
      },
    });
    const dialog = await openAcceptance(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Aceitar atividade' }),
    );

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Cancelar' }),
      ).toBeDisabled(),
    );
    release();
    await screen.findByText('Atividade concluída');
    expect(reviewBodies(fetchMock)).toHaveLength(1);
  });
});

describe('Revisão: recusar (RN40)', () => {
  it('explica que a atividade volta ao aluno e só habilita a recusa com justificativa válida', async () => {
    const { events } = setup();

    const dialog = await openRefusal(events);

    expect(
      within(dialog).getByText(
        /voltará para Pendente e o aluno recupera o controle/,
      ),
    ).toBeVisible();
    const refuse = within(dialog).getByRole('button', {
      name: 'Recusar atividade',
    });
    expect(refuse).toBeDisabled();
    expect(within(dialog).getByText('0/500')).toBeVisible();

    await writeJustification(events, dialog, '   ');
    expect(refuse).toBeDisabled();
    expect(within(dialog).getByText('0/500')).toBeVisible();

    await events.paste('Faltou a conclusão.');
    expect(refuse).toBeEnabled();
    expect(within(dialog).getByText('19/500')).toBeVisible();
  });

  it('bloqueia mais de 500 caracteres, contando sem as pontas, e mostra o erro no campo', async () => {
    const { events } = setup();
    const dialog = await openRefusal(events);
    const refuse = within(dialog).getByRole('button', {
      name: 'Recusar atividade',
    });

    await writeJustification(events, dialog, ' ' + 'a'.repeat(500) + ' ');
    expect(refuse).toBeEnabled();
    expect(within(dialog).getByText('500/500')).toBeVisible();

    await events.paste('a');
    expect(refuse).toBeDisabled();
    expect(
      within(dialog).getByText(/deve ter no máximo 500 caracteres/),
    ).toBeVisible();
  });

  it('enviar manda rejected com a justificativa sem as pontas, avisa, devolve ao aluno e mostra a recusa no histórico', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openRefusal(events);
    await writeJustification(
      events,
      dialog,
      '  Faltou a conclusão.\nRefaça o capítulo.  ',
    );

    await events.click(
      within(dialog).getByRole('button', { name: 'Recusar atividade' }),
    );

    expect(
      await screen.findByText('Atividade devolvida ao aluno'),
    ).toBeVisible();
    expect(reviewBodies(fetchMock)).toEqual([
      {
        decision: 'rejected',
        justification: 'Faltou a conclusão.\nRefaça o capítulo.',
      },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Pendente')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Revisão' }),
    ).not.toBeInTheDocument();
    const history = await screen.findByRole('region', { name: 'Revisões' });
    expect(within(history).getByText(/Recusada em/)).toBeVisible();
    const justification = within(history).getByText(/Faltou a conclusão\./);
    expect(justification.textContent).toBe(
      'Faltou a conclusão.\nRefaça o capítulo.',
    );
    expect(justification).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('um erro de validação do servidor aparece no campo da justificativa', async () => {
    const { events } = setup({}, 'teacher', {
      [REVIEW]: {
        status: 422,
        body: {
          detail: [
            {
              loc: ['body', 'payload', 'justification'],
              msg: 'Informe a justificativa da recusa (de 1 a 500 caracteres).',
              type: 'value_error',
            },
          ],
        },
      },
    });
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Refazer.');

    await events.click(
      within(dialog).getByRole('button', { name: 'Recusar atividade' }),
    );

    expect(
      await within(dialog).findByText(
        'Informe a justificativa da recusa (de 1 a 500 caracteres).',
      ),
    ).toBeVisible();
    expect(dialog).toBeVisible();
  });

  it('trava o botão enquanto envia e faz um pedido só', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup({}, 'teacher', {
      [REVIEW]: async () => {
        await gate;
        return { body: makeActivity(5, { status: 'pending' }) };
      },
    });
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Refazer.');

    await events.click(
      within(dialog).getByRole('button', { name: 'Recusar atividade' }),
    );

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Voltar' }),
      ).toBeDisabled(),
    );
    expect(
      within(dialog).getByRole('button', { name: 'Recusando…' }),
    ).toBeDisabled();
    release();
    await screen.findByText('Atividade devolvida ao aluno');
    expect(reviewBodies(fetchMock)).toHaveLength(1);
  });
});

describe('Revisão: alterações não enviadas (RNF28)', () => {
  it('sem texto não há aviso nem confirmação ao voltar', async () => {
    const { events } = setup();
    const dialog = await openRefusal(events);

    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();
    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('com texto mostra o aviso no topo e pede confirmação ao voltar', async () => {
    const { fetchMock, events } = setup();
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Rascunho');

    expect(
      within(dialog).getByText(/Você tem alterações não salvas/),
    ).toBeVisible();
    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));

    const confirm = await screen.findByRole('dialog', {
      name: 'Descartar alterações?',
    });
    await events.click(
      within(confirm).getByRole('button', { name: 'Continuar editando' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Recusar a atividade' }),
    ).toBeVisible();

    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));
    await events.click(
      within(
        await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
      ).getByRole('button', { name: 'Sair sem salvar' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(reviewBodies(fetchMock)).toEqual([]);
  });
});

describe('Revisão: o histórico (RN40)', () => {
  const REVIEWS: FakeActivity['reviews'] = [
    {
      id: 1,
      decision: 'rejected',
      justification: 'Faltou a conclusão.',
      decided_at: '2026-11-06T10:00:00Z',
    },
    {
      id: 2,
      decision: 'accepted',
      justification: '',
      decided_at: '2026-11-08T10:00:00Z',
    },
  ];

  it.each(['teacher', 'student'] as const)(
    'o %s vê a decisão, a data e a justificativa das recusas, na ordem da API',
    async (user) => {
      setup({ status: 'completed', reviews: REVIEWS }, user);

      const history = await screen.findByRole('region', { name: 'Revisões' });

      const items = within(history).getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent(/Recusada em/);
      expect(items[0]).toHaveTextContent('Faltou a conclusão.');
      expect(items[1]).toHaveTextContent(/Aceita em/);
      expect(items[1]).not.toHaveTextContent(/Justificativa/);
    },
  );
});

describe('Revisão: erros', () => {
  it('um 409 ao aceitar fecha a confirmação, mostra a mensagem do servidor e recarrega o detalhe', async () => {
    const { fetchMock, events } = setup({}, 'teacher', {
      [REVIEW]: {
        status: 409,
        body: { detail: 'Só uma atividade em revisão pode ser revisada.' },
      },
    });
    const dialog = await openAcceptance(events);
    const reads = requestsTo(fetchMock, 'GET /api/atividades/5').length;

    await events.click(
      within(dialog).getByRole('button', { name: 'Aceitar atividade' }),
    );

    expect(
      await screen.findByText('Só uma atividade em revisão pode ser revisada.'),
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

  it('um 404 ao aceitar avisa que a orientação foi encerrada e atualiza a sessão', async () => {
    const { fetchMock, events } = setup({}, 'teacher', {
      [REVIEW]: { status: 404, body: { detail: 'Atividade não encontrada.' } },
    });
    const dialog = await openAcceptance(events);
    const reads = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(
      within(dialog).getByRole('button', { name: 'Aceitar atividade' }),
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

  it.each([
    [409, 'Só uma atividade em revisão pode ser revisada.'],
    [404, 'A orientação foi encerrada.'],
  ])(
    'um %i ao recusar fecha o diálogo, avisa e recarrega o detalhe',
    async (status, message) => {
      const { fetchMock, events } = setup({}, 'teacher', {
        [REVIEW]: {
          status,
          body: {
            detail:
              status === 409
                ? 'Só uma atividade em revisão pode ser revisada.'
                : 'Atividade não encontrada.',
          },
        },
      });
      const dialog = await openRefusal(events);
      await writeJustification(events, dialog, 'Refazer.');
      const reads = requestsTo(fetchMock, 'GET /api/atividades/5').length;

      await events.click(
        within(dialog).getByRole('button', { name: 'Recusar atividade' }),
      );

      expect(await screen.findByText(message)).toBeVisible();
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(
          requestsTo(fetchMock, 'GET /api/atividades/5').length,
        ).toBeGreaterThan(reads),
      );
    },
  );

  it('uma falha do servidor ao aceitar mostra a mensagem e deixa tentar de novo', async () => {
    const { events } = setup({}, 'teacher', {
      [REVIEW]: { status: 500, body: {} },
    });
    const dialog = await openAcceptance(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Aceitar atividade' }),
    );

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      within(await panel()).getByRole('button', { name: 'Aceitar' }),
    ).toBeEnabled();
  });
});
