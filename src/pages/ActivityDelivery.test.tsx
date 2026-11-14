import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { ActivitiesServer, FakeActivity } from '../test/activitiesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { mockUploads } from '../test/mockUpload';
import type { UploadContext, UploadRequest } from '../test/mockUpload';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const UPLOAD = 'POST /api/atividades/5/entregas';
const MB = 1024 * 1024;

type UploadHandler = (
  request: UploadRequest,
  context: UploadContext,
) => MockResponse | Promise<MockResponse>;

/** O servidor grava a Entrega, e a próxima leitura do detalhe a mostra. */
function recordDelivery(server: ActivitiesServer): UploadHandler {
  return (request) => {
    const activity = server.activities()[0]!;
    activity.submissions.push({
      id: 90 + activity.submissions.length,
      submitted_at: '2026-11-09T12:00:00Z',
      files: request.files.map((file, index) => ({
        id: 300 + index,
        file_name: file.name,
        size_bytes: file.size,
        content_type: file.type,
      })),
    });
    return { status: 201, body: {} };
  };
}

function setup(
  activity: Partial<FakeActivity> = {},
  user: 'student' | 'teacher' = 'student',
  upload?: (server: ActivitiesServer) => UploadHandler | MockResponse,
) {
  const server = activitiesServer([makeActivity(5, activity)], { user });
  const fetchMock = mockApi(server.routes);
  const handler = upload ? upload(server) : recordDelivery(server);
  const { requests } = mockUploads({ [UPLOAD]: handler });
  const events = userEvent.setup({ applyAccept: false });
  renderApp(
    user === 'student' ? '/aluno/atividades/5' : '/professor/atividades/5',
  );
  return { fetchMock, events, server, uploads: requests };
}

function file(
  name: string,
  { size, type = 'application/pdf' } = {} as {
    size?: number;
    type?: string;
  },
) {
  const created = new File(['conteúdo'], name, { type });
  if (size !== undefined)
    Object.defineProperty(created, 'size', { value: size });
  return created;
}

async function openDialog(events: ReturnType<typeof userEvent.setup>) {
  await events.click(
    await screen.findByRole('button', { name: 'Entregar arquivos' }),
  );
  return screen.findByRole('dialog', { name: 'Entregar arquivos' });
}

const chooser = (dialog: HTMLElement) =>
  within(dialog).getByLabelText(/Escolher arquivos/);
const submit = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: 'Entregar' });

async function choose(
  events: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  ...files: File[]
) {
  await events.upload(chooser(dialog), files);
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Entregar arquivos: quem vê o botão', () => {
  it.each(['pending', 'in_progress'] as const)(
    'o aluno vê o botão com a atividade %s',
    async (status) => {
      setup({ status });

      expect(
        await screen.findByRole('button', { name: 'Entregar arquivos' }),
      ).toBeVisible();
    },
  );

  it.each(['in_review', 'completed'] as const)(
    'o aluno não vê o botão com a atividade %s',
    async (status) => {
      setup({ status });

      await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

      expect(
        screen.queryByRole('button', { name: 'Entregar arquivos' }),
      ).not.toBeInTheDocument();
    },
  );

  it('o professor não vê o botão', async () => {
    setup({}, 'teacher');

    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

    expect(
      screen.queryByRole('button', { name: 'Entregar arquivos' }),
    ).not.toBeInTheDocument();
  });
});

describe('Entregar arquivos: escolher e conferir', () => {
  it('abre sem arquivos, com a entrega desabilitada', async () => {
    const { events } = setup();

    const dialog = await openDialog(events);

    expect(within(dialog).getByText('Nenhum arquivo escolhido.')).toBeVisible();
    expect(submit(dialog)).toBeDisabled();
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();
  });

  it('mostra o nome, o tamanho e o tipo de cada arquivo escolhido, e deixa remover um', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);

    await choose(
      events,
      dialog,
      file('relatorio.pdf', { size: 1536 }),
      file('codigo.zip', { size: 3 * MB, type: 'application/zip' }),
    );

    const list = within(dialog).getByRole('list', {
      name: 'Arquivos escolhidos',
    });
    expect(within(list).getByText('relatorio.pdf')).toBeVisible();
    expect(within(list).getByText(/1,5 KB, application\/pdf/)).toBeVisible();
    expect(within(list).getByText(/3,0 MB, application\/zip/)).toBeVisible();
    expect(submit(dialog)).toBeEnabled();

    await events.click(
      within(dialog).getByRole('button', { name: 'Remover relatorio.pdf' }),
    );

    expect(within(list).queryByText('relatorio.pdf')).not.toBeInTheDocument();
    expect(within(list).getByText('codigo.zip')).toBeVisible();
  });

  it('aceita arquivos soltos na área de soltar', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);

    fireEvent.drop(
      within(dialog).getByRole('group', { name: 'Área para soltar arquivos' }),
      {
        dataTransfer: { files: [file('solto.pdf')] },
      },
    );

    expect(await within(dialog).findByText('solto.pdf')).toBeVisible();
    expect(submit(dialog)).toBeEnabled();
  });

  it('escolhe em mais de uma vez e junta os arquivos', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);

    await choose(events, dialog, file('a.pdf'));
    await choose(events, dialog, file('b.pdf'));

    const list = within(dialog).getByRole('list', {
      name: 'Arquivos escolhidos',
    });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('Entregar arquivos: validação no cliente, por arquivo', () => {
  it.each([
    ['vazio.pdf', { size: 0 }, 'O arquivo está vazio.'],
    [
      'grande.pdf',
      { size: 10 * MB + 1 },
      'O arquivo excede o limite de 10 MB.',
    ],
    [
      'programa.exe',
      { type: 'application/x-msdownload' },
      'Tipo de arquivo não permitido. Envie PDF, DOC, DOCX, ZIP, PNG ou JPG.',
    ],
    [
      'sem_extensao',
      {},
      'Tipo de arquivo não permitido. Envie PDF, DOC, DOCX, ZIP, PNG ou JPG.',
    ],
  ])(
    '%s mostra a mensagem ao lado do arquivo e bloqueia a entrega até removê-lo',
    async (name, options, message) => {
      const { events } = setup();
      const dialog = await openDialog(events);

      await choose(events, dialog, file('bom.pdf'), file(name, options));

      const items = within(dialog).getAllByRole('listitem');
      expect(within(items[1]!).getByText(message)).toBeVisible();
      expect(within(items[0]!).queryByText(message)).not.toBeInTheDocument();
      expect(submit(dialog)).toBeDisabled();

      await events.click(
        within(dialog).getByRole('button', { name: `Remover ${name}` }),
      );

      expect(submit(dialog)).toBeEnabled();
    },
  );

  it.each([
    'FOTO.JPG',
    'foto.jpeg',
    'planilha.DOCX',
    'modelo.doc',
    'grafico.png',
    'tudo.zip',
  ])('aceita %s', async (name) => {
    const { events } = setup();
    const dialog = await openDialog(events);

    await choose(events, dialog, file(name, { type: '' }));

    expect(submit(dialog)).toBeEnabled();
  });

  it('o limite de 10 MB vale: exatamente 10 MB passa', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);

    await choose(events, dialog, file('limite.pdf', { size: 10 * MB }));

    expect(submit(dialog)).toBeEnabled();
  });

  it('mais de 5 arquivos de uma vez: entram 5 e avisa da quantidade', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);

    await choose(
      events,
      dialog,
      ...[1, 2, 3, 4, 5, 6].map((n) => file(`${n}.pdf`)),
    );

    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);
    expect(
      within(dialog).getByText('Envie no máximo 5 arquivos por entrega.'),
    ).toBeVisible();
    expect(within(dialog).queryByText('6.pdf')).not.toBeInTheDocument();
    expect(submit(dialog)).toBeEnabled();
  });

  it('completar além de 5 em outra escolha também avisa, e o aviso some ao remover', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);
    await choose(
      events,
      dialog,
      file('1.pdf'),
      file('2.pdf'),
      file('3.pdf'),
      file('4.pdf'),
    );

    await choose(events, dialog, file('5.pdf'), file('6.pdf'));

    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);
    expect(
      within(dialog).getByText('Envie no máximo 5 arquivos por entrega.'),
    ).toBeVisible();
    await events.click(
      within(dialog).getByRole('button', { name: 'Remover 1.pdf' }),
    );
    expect(
      within(dialog).queryByText('Envie no máximo 5 arquivos por entrega.'),
    ).not.toBeInTheDocument();
  });
});

describe('Entregar arquivos: o envio', () => {
  it('envia os arquivos na ordem, avisa, fecha e mostra a Entrega na lista', async () => {
    const { events, uploads } = setup();
    const dialog = await openDialog(events);
    await choose(events, dialog, file('primeiro.pdf'), file('segundo.pdf'));

    await events.click(submit(dialog));

    expect(await screen.findByText('Entrega enviada.')).toBeVisible();
    expect(uploads).toHaveLength(1);
    expect(uploads[0]!.files.map((item) => item.name)).toEqual([
      'primeiro.pdf',
      'segundo.pdf',
    ]);
    expect(uploads[0]!.headers.get('Authorization')).toMatch(/^Bearer /);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    const section = await screen.findByRole('region', {
      name: 'Linha do tempo',
    });
    expect(await within(section).findByText('primeiro.pdf')).toBeVisible();
    expect(within(section).getByText('segundo.pdf')).toBeVisible();
  });

  it('mostra o progresso em porcentagem e trava o diálogo enquanto envia', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { events } = setup({}, 'student', (server) => {
      const record = recordDelivery(server);
      return async (request, context) => {
        context.progress(40, 100);
        await gate;
        context.progress(100, 100);
        return record(request, context);
      };
    });
    const dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));

    await events.click(submit(dialog));

    const bar = await within(dialog).findByRole('progressbar', {
      name: 'Progresso do envio',
    });
    await waitFor(() => expect(bar).toHaveAttribute('aria-valuenow', '40'));
    expect(within(dialog).getByText('Enviando… 40%')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Remover a.pdf' }),
    ).toBeDisabled();
    expect(chooser(dialog)).toBeDisabled();
    release();
    await screen.findByText('Entrega enviada.');
  });

  it('o Esc durante o envio não fecha o diálogo nem pede para descartar', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { events } = setup({}, 'student', (server) => {
      const record = recordDelivery(server);
      return async (request, context) => {
        await gate;
        return record(request, context);
      };
    });
    const dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));
    await events.click(submit(dialog));
    await within(dialog).findByRole('progressbar', {
      name: 'Progresso do envio',
    });

    // O botão de entregar desabilita e perde o foco: o Esc é enviado ao próprio diálogo.
    fireEvent.keyDown(
      screen.getByRole('dialog', { name: 'Entregar arquivos' }),
      {
        key: 'Escape',
      },
    );

    expect(
      screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Entregar arquivos' }),
    ).toBeVisible();
    release();
    await screen.findByText('Entrega enviada.');
  });

  it('um erro por arquivo do servidor aparece junto do arquivo certo, e o diálogo continua aberto', async () => {
    const { events } = setup({}, 'student', () => ({
      status: 422,
      body: {
        detail: [
          {
            loc: ['body', 'payload', 'files.1'],
            msg: 'O conteúdo do arquivo não corresponde ao tipo informado pela extensão.',
          },
        ],
      },
    }));
    const dialog = await openDialog(events);
    await choose(
      events,
      dialog,
      file('bom.pdf'),
      file('falso.png', { type: 'image/png' }),
    );

    await events.click(submit(dialog));

    const items = within(dialog).getAllByRole('listitem');
    expect(
      await within(items[1]!).findByText(
        'O conteúdo do arquivo não corresponde ao tipo informado pela extensão.',
      ),
    ).toBeVisible();
    expect(
      within(items[0]!).queryByText(/conteúdo do arquivo/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Entregar arquivos' }),
    ).toBeVisible();
    expect(submit(dialog)).toBeEnabled();
  });

  it('o erro de quantidade do servidor aparece como aviso do diálogo', async () => {
    const { events } = setup({}, 'student', () => ({
      status: 422,
      body: {
        detail: [
          {
            loc: ['body', 'payload', 'files'],
            msg: 'Envie de 1 a 5 arquivos por entrega.',
          },
        ],
      },
    }));
    const dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));

    await events.click(submit(dialog));

    expect(
      await within(dialog).findByText('Envie de 1 a 5 arquivos por entrega.'),
    ).toBeVisible();
  });

  it('uma falha de rede mostra a mensagem e deixa tentar de novo com os mesmos arquivos', async () => {
    const { events } = setup({}, 'student', () => ({
      status: 503,
      body: {
        detail: 'Não foi possível guardar os arquivos. Tente novamente.',
      },
    }));
    const dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));

    await events.click(submit(dialog));

    expect(
      await within(dialog).findByText(
        'Não foi possível guardar os arquivos. Tente novamente.',
      ),
    ).toBeVisible();
    expect(within(dialog).getByText('a.pdf')).toBeVisible();
    expect(submit(dialog)).toBeEnabled();
  });

  it('um 409 fecha o diálogo, mostra a mensagem do servidor e recarrega o detalhe', async () => {
    const { fetchMock, events } = setup({}, 'student', () => ({
      status: 409,
      body: {
        detail: 'Esta atividade está em revisão e não aceita novas entregas.',
      },
    }));
    const dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));
    const reads = requestsTo(fetchMock, 'GET /api/atividades/5').length;

    await events.click(submit(dialog));

    expect(
      await screen.findByText(
        'Esta atividade está em revisão e não aceita novas entregas.',
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
    const { fetchMock, events } = setup({}, 'student', () => ({
      status: 404,
      body: { detail: 'Atividade não encontrada.' },
    }));
    const dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));
    const reads = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(submit(dialog));

    expect(
      await screen.findByText('A orientação foi encerrada.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET /api/auth/me').length).toBeGreaterThan(
        reads,
      ),
    );
  });
});

describe('Entregar arquivos: alterações não enviadas (RNF28)', () => {
  it('sem arquivos, Cancelar fecha direto', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Entregar arquivos' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
    ).not.toBeInTheDocument();
  });

  it('com arquivos escolhidos mostra o aviso no topo e pede confirmação antes de fechar', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));

    expect(
      await within(dialog).findByText(/Você tem alterações não salvas/),
    ).toHaveTextContent('Clique em Entregar para gravá-las.');
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
    expect(within(dialog).getByText('a.pdf')).toBeVisible();

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    await events.click(
      await screen.findByRole('button', { name: 'Sair sem salvar' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Entregar arquivos' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('sair da tela por um link do menu com arquivos escolhidos pede confirmação', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));

    await events.click(
      screen.getByRole('link', { name: 'Meu perfil', hidden: true }),
    );

    expect(
      await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
    ).toBeVisible();
  });

  it('removendo todos os arquivos o aviso some', async () => {
    const { events } = setup();
    const dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));
    await within(dialog).findByText(/Você tem alterações não salvas/);

    await events.click(
      within(dialog).getByRole('button', { name: 'Remover a.pdf' }),
    );

    await waitFor(() =>
      expect(
        within(dialog).queryByText(/Você tem alterações não salvas/),
      ).not.toBeInTheDocument(),
    );
  });

  it('reabrir o diálogo depois de uma entrega começa sem arquivos', async () => {
    const { events } = setup();
    let dialog = await openDialog(events);
    await choose(events, dialog, file('a.pdf'));
    await events.click(submit(dialog));
    await screen.findByText('Entrega enviada.');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    dialog = await openDialog(events);

    expect(within(dialog).getByText('Nenhum arquivo escolhido.')).toBeVisible();
  });
});
