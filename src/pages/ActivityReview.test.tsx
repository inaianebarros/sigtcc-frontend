import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { mockUploads, UploadNetworkError } from '../test/mockUpload';
import type { UploadContext, UploadRequest } from '../test/mockUpload';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const REVIEW = 'POST /api/atividades/:id/revisar';
const REVIEW_PATH = 'POST /api/atividades/5/revisar';
const REFUSE = 'POST /api/atividades/5/recusar';
const MB = 1024 * 1024;
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

type UploadHandler = (
  request: UploadRequest,
  context: UploadContext,
) => MockResponse | Promise<MockResponse>;

/** O servidor grava a recusa, com os anexos, e a atividade volta para pendente. */
function recordRefusal(
  server: ReturnType<typeof activitiesServer>,
): UploadHandler {
  return (request) => {
    const activity = server.activities()[0]!;
    activity.reviews.push({
      id: activity.reviews.length + 1,
      decision: 'rejected',
      justification: String(request.body.get('justification')),
      decided_at: '2026-11-09T12:00:00Z',
      files: request.files.map((file, index) => ({
        id: 400 + index,
        file_name: file.name,
        size_bytes: file.size,
        content_type: file.type,
      })),
    });
    activity.status = 'pending';
    return { body: {} };
  };
}

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup(
  activity: Partial<FakeActivity> = {},
  user: 'student' | 'teacher' = 'teacher',
  overrides: Overrides = {},
  refuse?: (server: ReturnType<typeof activitiesServer>) => UploadHandler,
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
  const { requests: refusals } = mockUploads({
    [REFUSE]: refuse ? refuse(server) : recordRefusal(server),
  });
  const events = userEvent.setup({ applyAccept: false });
  renderApp(
    user === 'student' ? '/aluno/atividades/5' : '/professor/atividades/5',
  );
  return { fetchMock, events, server, refusals };
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

function file(
  name: string,
  { size, type = 'application/pdf' } = {} as { size?: number; type?: string },
) {
  const created = new File(['conteúdo'], name, { type });
  if (size !== undefined)
    Object.defineProperty(created, 'size', { value: size });
  return created;
}

const refuseButton = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: 'Recusar atividade' });

async function choose(
  events: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  ...files: File[]
) {
  await events.upload(
    within(dialog).getByLabelText(/Escolher arquivos/),
    files,
  );
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

  it('o professor abre o material pela linha do tempo, que já mostra as entregas', async () => {
    setup();

    const deliveries = await screen.findByRole('region', {
      name: 'Linha do tempo',
    });

    expect(await within(deliveries).findByText('capitulo2.pdf')).toBeVisible();
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
    const history = await screen.findByRole('region', {
      name: 'Linha do tempo',
    });
    expect(await within(history).findByText('Aceita')).toBeVisible();
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

  it('enviar manda a justificativa sem as pontas por /recusar, avisa, devolve ao aluno e mostra a recusa no histórico', async () => {
    const { fetchMock, events, refusals } = setup();
    const dialog = await openRefusal(events);
    await writeJustification(
      events,
      dialog,
      '  Faltou a conclusão.\nRefaça o capítulo.  ',
    );

    await events.click(refuseButton(dialog));

    expect(
      await screen.findByText('Atividade devolvida ao aluno'),
    ).toBeVisible();
    expect(refusals).toHaveLength(1);
    expect(refusals[0]!.body.get('justification')).toBe(
      'Faltou a conclusão.\nRefaça o capítulo.',
    );
    expect(refusals[0]!.files).toEqual([]);
    expect(reviewBodies(fetchMock)).toEqual([]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Pendente')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Revisão' }),
    ).not.toBeInTheDocument();
    const history = await screen.findByRole('region', {
      name: 'Linha do tempo',
    });
    expect(await within(history).findByText('Recusada')).toBeVisible();
    const justification = within(history).getByText(/Faltou a conclusão\./);
    expect(justification.textContent).toBe(
      'Faltou a conclusão.\nRefaça o capítulo.',
    );
    expect(justification).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('um erro de validação do servidor aparece no campo da justificativa', async () => {
    const { events } = setup({}, 'teacher', {}, () => () => ({
      status: 422,
      body: {
        detail: [
          {
            loc: ['body', 'justification'],
            msg: 'Informe a justificativa da recusa (de 1 a 500 caracteres).',
            type: 'value_error',
          },
        ],
      },
    }));
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Refazer.');

    await events.click(refuseButton(dialog));

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
    const { events, refusals } = setup({}, 'teacher', {}, (server) => {
      const record = recordRefusal(server);
      return async (request, context) => {
        await gate;
        return record(request, context);
      };
    });
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Refazer.');

    await events.click(refuseButton(dialog));

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
    expect(refusals).toHaveLength(1);
  });
});

describe('Revisão: recusar com arquivos (RF46)', () => {
  it('explica que os anexos são opcionais, de 0 a 5, e não os exige para recusar', async () => {
    const { events } = setup();

    const dialog = await openRefusal(events);

    expect(
      within(dialog).getByText(/De 0 a 5 arquivos de até 10 MB/),
    ).toBeVisible();
    expect(within(dialog).getByText('Nenhum arquivo escolhido.')).toBeVisible();
    await writeJustification(events, dialog, 'Refazer.');
    expect(refuseButton(dialog)).toBeEnabled();
  });

  it('funciona só pelo teclado: chega ao seletor, remove um arquivo e recusa com Enter', async () => {
    const { events, refusals } = setup();
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Refazer.');
    await choose(events, dialog, file('a.pdf'), file('b.pdf'));

    within(dialog)
      .getByLabelText(/Justificativa/)
      .focus();
    await events.tab();
    expect(within(dialog).getByText('Escolher arquivos')).toHaveFocus();
    await events.tab();
    const remove = within(dialog).getByRole('button', {
      name: 'Remover a.pdf',
    });
    expect(remove).toHaveFocus();
    await events.keyboard('{Enter}');
    expect(within(dialog).queryByText('a.pdf')).not.toBeInTheDocument();

    refuseButton(dialog).focus();
    await events.keyboard('{Enter}');

    await screen.findByText('Atividade devolvida ao aluno');
    expect(refusals[0]!.files.map((item) => item.name)).toEqual(['b.pdf']);
  });

  it('mostra nome e tamanho de cada arquivo escolhido e deixa remover um', async () => {
    const { events } = setup();
    const dialog = await openRefusal(events);

    await choose(
      events,
      dialog,
      file('correcoes.pdf', { size: 1536 }),
      file('modelo.docx', { size: 2 * MB }),
    );

    const list = within(dialog).getByRole('list', {
      name: 'Arquivos escolhidos',
    });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('correcoes.pdf')).toBeVisible();
    expect(within(list).getByText(/1,5 KB/)).toBeVisible();
    await events.click(
      within(dialog).getByRole('button', { name: 'Remover correcoes.pdf' }),
    );
    expect(within(list).queryByText('correcoes.pdf')).not.toBeInTheDocument();
    expect(within(list).getByText('modelo.docx')).toBeVisible();
  });

  it('envia os arquivos junto com a justificativa e os mostra no histórico', async () => {
    const { events, refusals } = setup();
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Veja as correções.');
    await choose(events, dialog, file('correcoes.pdf'), file('print.png'));

    await events.click(refuseButton(dialog));

    await screen.findByText('Atividade devolvida ao aluno');
    expect(refusals).toHaveLength(1);
    expect(refusals[0]!.url.pathname).toBe('/api/atividades/5/recusar');
    expect(refusals[0]!.body.get('justification')).toBe('Veja as correções.');
    expect(refusals[0]!.files.map((item) => item.name)).toEqual([
      'correcoes.pdf',
      'print.png',
    ]);
    expect(refusals[0]!.headers.get('Authorization')).toMatch(/^Bearer /);
  });

  it('mostra o andamento do envio e trava a escolha enquanto envia', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { events } = setup({}, 'teacher', {}, (server) => {
      const record = recordRefusal(server);
      return async (request, context) => {
        context.progress(40, 100);
        await gate;
        return record(request, context);
      };
    });
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Refazer.');
    await choose(events, dialog, file('correcoes.pdf'));

    await events.click(refuseButton(dialog));

    expect(await within(dialog).findByText('Enviando… 40%')).toBeVisible();
    expect(
      within(dialog).getByRole('progressbar', { name: 'Progresso do envio' }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Remover correcoes.pdf' }),
    ).toBeDisabled();
    release();
    await screen.findByText('Atividade devolvida ao aluno');
  });

  it.each([
    ['tipo não permitido', 'notas.exe', 10, /Tipo de arquivo não permitido/],
    ['acima de 10 MB', 'grande.pdf', 10 * MB + 1, /excede o limite de 10 MB/],
    ['vazio', 'vazio.pdf', 0, /O arquivo está vazio/],
  ])(
    'recusa antes do envio o arquivo %s e bloqueia a recusa',
    async (_label, name, size, message) => {
      const { events, refusals } = setup();
      const dialog = await openRefusal(events);
      await writeJustification(events, dialog, 'Refazer.');

      await choose(events, dialog, file(name, { size }));

      expect(within(dialog).getByText(message)).toBeVisible();
      expect(refuseButton(dialog)).toBeDisabled();
      await events.click(
        within(dialog).getByRole('button', { name: `Remover ${name}` }),
      );
      expect(refuseButton(dialog)).toBeEnabled();
      expect(refusals).toHaveLength(0);
    },
  );

  it('avisa e ignora os arquivos que passam de 5', async () => {
    const { events } = setup();
    const dialog = await openRefusal(events);

    await choose(
      events,
      dialog,
      ...[1, 2, 3, 4, 5, 6].map((n) => file(`arquivo${n}.pdf`)),
    );

    expect(
      within(dialog).getByText('Anexe até 5 arquivos à recusa.'),
    ).toBeVisible();
    expect(
      within(
        within(dialog).getByRole('list', { name: 'Arquivos escolhidos' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(5);
  });

  it('um erro de arquivo do servidor aparece ao lado do arquivo, sem fechar o diálogo', async () => {
    const { events } = setup({}, 'teacher', {}, () => () => ({
      status: 422,
      body: {
        detail: [
          {
            loc: ['body', 'files.1'],
            msg: 'O conteúdo do arquivo não corresponde ao tipo informado.',
            type: 'value_error',
          },
        ],
      },
    }));
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Refazer.');
    await choose(events, dialog, file('a.pdf'), file('b.pdf'));

    await events.click(refuseButton(dialog));

    const items = within(dialog).getAllByRole('listitem');
    expect(
      await within(items[1]!).findByText(
        'O conteúdo do arquivo não corresponde ao tipo informado.',
      ),
    ).toBeVisible();
    expect(dialog).toBeVisible();
  });

  it('se a recusa falhar mostra a mensagem, preserva texto e arquivos, deixa tentar de novo e a tela não muda', async () => {
    let attempt = 0;
    const { events, refusals } = setup({}, 'teacher', {}, (server) => {
      const record = recordRefusal(server);
      return (request, context) => {
        attempt += 1;
        return attempt === 1
          ? { status: 503, body: { detail: 'Armazenamento indisponível.' } }
          : record(request, context);
      };
    });
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Refazer o capítulo 2.');
    await choose(events, dialog, file('correcoes.pdf'));

    await events.click(refuseButton(dialog));

    expect(
      await within(dialog).findByText('Armazenamento indisponível.'),
    ).toBeVisible();
    expect(within(dialog).getByLabelText(/Justificativa/)).toHaveValue(
      'Refazer o capítulo 2.',
    );
    expect(within(dialog).getByText('correcoes.pdf')).toBeVisible();
    expect(refuseButton(dialog)).toBeEnabled();
    expect(screen.queryByText('Atividade devolvida ao aluno')).toBeNull();

    await events.click(refuseButton(dialog));

    await screen.findByText('Atividade devolvida ao aluno');
    expect(refusals).toHaveLength(2);
    expect(refusals[1]!.files.map((item) => item.name)).toEqual([
      'correcoes.pdf',
    ]);
  });

  it('uma falha de rede também mostra uma mensagem em português e preserva tudo', async () => {
    const { events } = setup({}, 'teacher', {}, () => () => {
      throw new UploadNetworkError();
    });
    const dialog = await openRefusal(events);
    await writeJustification(events, dialog, 'Refazer.');
    await choose(events, dialog, file('a.pdf'));

    await events.click(refuseButton(dialog));

    expect(
      await within(dialog).findByText(/Não foi possível conectar ao servidor/),
    ).toBeVisible();
    expect(within(dialog).getByText('a.pdf')).toBeVisible();
    expect(dialog).toBeVisible();
  });
});

describe('Revisão: alterações não enviadas (RNF28)', () => {
  it('sem texto nem arquivos não há aviso nem confirmação ao voltar', async () => {
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

  it('só com arquivos escolhidos já mostra o aviso e pede confirmação ao voltar', async () => {
    const { events } = setup();
    const dialog = await openRefusal(events);
    await choose(events, dialog, file('correcoes.pdf'));

    expect(
      within(dialog).getByText(/Você tem alterações não salvas/),
    ).toBeVisible();
    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));

    expect(
      await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
    ).toBeVisible();
  });

  it('com texto mostra o aviso no topo e pede confirmação ao voltar', async () => {
    const { fetchMock, events, refusals } = setup();
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
    expect(refusals).toEqual([]);
  });
});

describe('Revisão: as avaliações na linha do tempo (RN40)', () => {
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
    'o %s vê a decisão, a data e a justificativa das recusas, do mais recente ao mais antigo',
    async (user) => {
      setup({ status: 'completed', reviews: REVIEWS }, user);

      const timeline = await screen.findByRole('region', {
        name: 'Linha do tempo',
      });
      await within(timeline).findByText('Atividade criada');

      const titles = within(timeline)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent);
      expect(titles).toEqual([
        'Avaliação da versão 1',
        'Avaliação da versão 1',
        'Entrega — Versão 1',
        'Atividade criada',
      ]);
      const [accepted, refused] = within(timeline)
        .getAllByText(/^Avaliação da versão/)
        .map((title) => title.closest('li')!);
      expect(accepted).toHaveTextContent('Aceita');
      expect(accepted).not.toHaveTextContent('Faltou a conclusão.');
      expect(refused).toHaveTextContent('Recusada');
      expect(refused).toHaveTextContent('Faltou a conclusão.');
      expect(refused).toHaveTextContent(/6 de novembro de 2026/);
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
      const { fetchMock, events } = setup({}, 'teacher', {}, () => () => ({
        status,
        body: {
          detail:
            status === 409
              ? 'Só uma atividade em revisão pode ser revisada.'
              : 'Atividade não encontrada.',
        },
      }));
      const dialog = await openRefusal(events);
      await writeJustification(events, dialog, 'Refazer.');
      await choose(events, dialog, file('correcoes.pdf'));
      const reads = requestsTo(fetchMock, 'GET /api/atividades/5').length;

      await events.click(refuseButton(dialog));

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
