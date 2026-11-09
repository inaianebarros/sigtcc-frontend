import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import {
  STUDENT_AUTHOR,
  TEACHER_AUTHOR,
  commentsServer,
  makeComment,
} from '../test/commentsApi';
import type { FakeComment } from '../test/commentsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/atividades/5/comentarios';
const POST = 'POST /api/atividades/5/comentarios';
const LIST_ROUTE = 'GET /api/atividades/:id/comentarios';
const POST_ROUTE = 'POST /api/atividades/:id/comentarios';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function numbered(count: number): FakeComment[] {
  return Array.from({ length: count }, (_, index) => makeComment(index + 1));
}

function setup(
  comments: FakeComment[] = [],
  {
    user = 'student',
    activity = {},
    overrides = {},
  }: {
    user?: 'student' | 'teacher';
    activity?: Partial<FakeActivity>;
    overrides?: Overrides;
  } = {},
) {
  const activities = activitiesServer(
    [makeActivity(5, { comments_count: comments.length, ...activity })],
    { user },
  );
  const server = commentsServer(
    comments,
    user === 'student' ? STUDENT_AUTHOR : TEACHER_AUTHOR,
    overrides as never,
  );
  const fetchMock = mockApi({ ...activities.routes, ...server.routes });
  const events = userEvent.setup({ applyAccept: false });
  renderApp(
    user === 'student' ? '/aluno/atividades/5' : '/professor/atividades/5',
  );
  return { fetchMock, events, server };
}

const section = () => screen.findByRole('region', { name: 'Comentários' });
const field = () => screen.findByLabelText(/Novo comentário/);
const sendButton = () => screen.findByRole('button', { name: 'Comentar' });

function listQueries(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, LIST).map(([input]) => {
    const url = new URL(String(input), 'http://localhost');
    return {
      limit: Number(url.searchParams.get('limit')),
      offset: Number(url.searchParams.get('offset')),
    };
  });
}

function postBodies(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, POST).map(
    ([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>,
  );
}

async function write(events: ReturnType<typeof userEvent.setup>, text: string) {
  await events.click(await field());
  await events.paste(text);
}

const texts = (region: HTMLElement) =>
  within(region)
    .getAllByRole('listitem')
    .map((item) => /Comentário \d+/.exec(item.textContent ?? '')?.[0]);

const scrollIntoView = vi.fn();

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

describe('Comentários: a lista', () => {
  it('abre na página mais recente, em ordem cronológica, e não rola ao abrir', async () => {
    const { fetchMock } = setup(numbered(45));

    const region = await section();

    await within(region).findByText('Comentário 45');
    expect(texts(region)).toEqual(
      Array.from({ length: 20 }, (_, index) => `Comentário ${index + 26}`),
    );
    expect(within(region).queryByText('Comentário 25')).not.toBeInTheDocument();
    expect(listQueries(fetchMock).at(-1)).toEqual({ limit: 20, offset: 25 });
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(within(region).getByText('45 comentários')).toBeVisible();
  });

  it('carrega os anteriores, sem números de página, até acabar o botão', async () => {
    const { fetchMock, events } = setup(numbered(45));
    const region = await section();
    await within(region).findByText('Comentário 45');

    await events.click(
      within(region).getByRole('button', {
        name: 'Carregar comentários anteriores',
      }),
    );

    await within(region).findByText('Comentário 6');
    expect(listQueries(fetchMock).at(-1)).toEqual({ limit: 20, offset: 5 });
    expect(texts(region)).toEqual(
      Array.from({ length: 40 }, (_, index) => `Comentário ${index + 6}`),
    );
    await events.click(
      within(region).getByRole('button', {
        name: 'Carregar comentários anteriores',
      }),
    );
    await within(region).findByText('Comentário 1');
    expect(listQueries(fetchMock).at(-1)).toEqual({ limit: 5, offset: 0 });
    expect(texts(region)).toHaveLength(45);
    expect(
      within(region).queryByRole('button', {
        name: 'Carregar comentários anteriores',
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toHaveTextContent(/página/i);
  });

  it('com poucos comentários mostra todos e não oferece os anteriores', async () => {
    const { fetchMock } = setup(numbered(3));

    const region = await section();

    await within(region).findByText('Comentário 3');
    expect(texts(region)).toHaveLength(3);
    expect(
      within(region).queryByRole('button', {
        name: 'Carregar comentários anteriores',
      }),
    ).not.toBeInTheDocument();
    expect(listQueries(fetchMock)).toHaveLength(1);
  });

  it('cada comentário mostra o autor, a etiqueta em texto, a data no fuso de Santarém e o texto puro', async () => {
    setup([
      makeComment(1, {
        text: 'Linha 1\nLinha <b>2</b>',
        author: TEACHER_AUTHOR,
      }),
    ]);

    const region = await section();

    const item = await within(region).findByRole('listitem');
    expect(within(item).getByText('Carlos Lima')).toBeVisible();
    expect(within(item).getByText('Professor')).toBeVisible();
    expect(
      within(item).getByText(/2 de novembro de 2026, às 11:30/),
    ).toBeVisible();
    const body = within(item).getByText(/Linha 1/);
    expect(body.textContent).toBe('Linha 1\nLinha <b>2</b>');
    expect(body).toHaveStyle({ whiteSpace: 'pre-wrap' });
    expect(within(item).queryByText('Você')).not.toBeInTheDocument();
  });

  it.each([
    ['student', STUDENT_AUTHOR, 'Aluno'],
    ['teacher', TEACHER_AUTHOR, 'Professor'],
  ] as const)(
    'o %s vê os próprios comentários marcados com "Você" e a etiqueta do seu tipo',
    async (user, author, tag) => {
      setup([makeComment(1, { author })], { user });

      const item = await within(await section()).findByRole('listitem');

      expect(within(item).getByText('Você')).toBeVisible();
      expect(within(item).getByText(tag)).toBeVisible();
    },
  );

  it('sem comentários mostra um estado vazio informativo (RNF22)', async () => {
    setup([]);

    const region = await section();

    expect(
      await within(region).findByText(/Nenhum comentário ainda/),
    ).toBeVisible();
    expect(within(region).queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('mostra um esqueleto enquanto a lista carrega', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setup(numbered(2), {
      overrides: {
        [LIST_ROUTE]: async () => {
          await gate;
          return { body: { items: numbered(2), count: 2 } };
        },
      },
    });
    const region = await section();

    expect(
      await within(region).findByTestId('comments-skeleton'),
    ).toBeInTheDocument();
    release();

    expect(await within(region).findByText('Comentário 2')).toBeVisible();
    expect(within(region).queryByTestId('comments-skeleton')).toBeNull();
  });

  it('mostra um erro com nova tentativa que funciona', async () => {
    let failing = true;
    const { events } = setup(numbered(2), {
      overrides: {
        [LIST_ROUTE]: () =>
          failing
            ? { status: 500, body: {} }
            : { body: { items: numbered(2), count: 2 } },
      },
    });
    const region = await section();

    expect(
      await within(region).findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    failing = false;
    await events.click(
      within(region).getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await within(region).findByText('Comentário 2')).toBeVisible();
  });
});

describe('Comentários: atualizar', () => {
  it('recarrega a página mais recente, mostra o que chegou e rola ao último', async () => {
    const { fetchMock, events, server } = setup(numbered(3));
    const region = await section();
    await within(region).findByText('Comentário 3');
    server.receive(makeComment(4, { author: TEACHER_AUTHOR }));
    const before = listQueries(fetchMock).length;

    await events.click(
      within(region).getByRole('button', { name: 'Atualizar' }),
    );

    await within(region).findByText('Comentário 4');
    expect(listQueries(fetchMock).length).toBeGreaterThan(before);
    expect(within(region).getByText('4 comentários')).toBeVisible();
    expect(texts(region)).toEqual([
      'Comentário 1',
      'Comentário 2',
      'Comentário 3',
      'Comentário 4',
    ]);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('mantém os comentários anteriores já carregados', async () => {
    const { events, server } = setup(numbered(25));
    const region = await section();
    await within(region).findByText('Comentário 25');
    await events.click(
      within(region).getByRole('button', {
        name: 'Carregar comentários anteriores',
      }),
    );
    await within(region).findByText('Comentário 1');
    server.receive(makeComment(26));

    await events.click(
      within(region).getByRole('button', { name: 'Atualizar' }),
    );

    await within(region).findByText('Comentário 26');
    expect(texts(region)).toHaveLength(26);
    expect(within(region).getByText('Comentário 1')).toBeVisible();
  });
});

describe('Comentários: o formulário', () => {
  it('valida de 1 a 1000 caracteres sem as pontas e mostra o contador', async () => {
    const { events } = setup([]);
    const button = await sendButton();
    const region = await section();

    expect(button).toBeDisabled();
    expect(within(region).getByText('0/1000')).toBeVisible();
    await write(events, '   ');
    expect(button).toBeDisabled();
    expect(within(region).getByText('0/1000')).toBeVisible();

    await events.paste('ok');
    expect(button).toBeEnabled();
    expect(within(region).getByText('2/1000')).toBeVisible();

    await events.clear(await field());
    await events.paste(' ' + 'a'.repeat(1000) + ' ');
    expect(button).toBeEnabled();
    expect(within(region).getByText('1000/1000')).toBeVisible();
    await events.paste('a');
    expect(button).toBeDisabled();
    expect(within(region).getByText(/no máximo 1000 caracteres/)).toBeVisible();
  });

  it('enviar manda o texto sem as pontas, acrescenta o comentário, limpa o campo, rola e atualiza a contagem', async () => {
    const { fetchMock, events } = setup(numbered(2));
    const region = await section();
    await within(region).findByText('Comentário 2');
    await write(events, '  Primeira linha\nSegunda  ');

    await events.click(await sendButton());

    await within(region).findByText(/Primeira linha/);
    expect(postBodies(fetchMock)).toEqual([
      { text: 'Primeira linha\nSegunda' },
    ]);
    expect((await field()) as HTMLTextAreaElement).toHaveValue('');
    expect(within(region).getByText('3 comentários')).toBeVisible();
    expect(
      within(within(region).getAllByRole('listitem').at(-1)!).getByText('Você'),
    ).toBeVisible();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('trava o botão enquanto envia e faz um pedido só', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup([], {
      overrides: {
        [POST_ROUTE]: async () => {
          await gate;
          return { status: 201, body: makeComment(1, { text: 'Oi' }) };
        },
      },
    });
    await write(events, 'Oi');

    await events.click(await sendButton());

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Comentando|Enviando/ }),
      ).toBeDisabled(),
    );
    release();
    await screen.findByText('Oi');
    expect(postBodies(fetchMock)).toHaveLength(1);
  });

  it('um erro de validação do servidor aparece no campo', async () => {
    const { events } = setup([], {
      overrides: {
        [POST_ROUTE]: {
          status: 422,
          body: {
            detail: [
              {
                loc: ['body', 'payload', 'text'],
                msg: 'String should have at most 1000 characters',
                type: 'string_too_long',
              },
            ],
          },
        },
      },
    });
    await write(events, 'Oi');

    await events.click(await sendButton());

    expect(
      await screen.findByText('String should have at most 1000 characters'),
    ).toBeVisible();
    expect((await field()) as HTMLTextAreaElement).toHaveValue('Oi');
  });

  it('o professor também comenta', async () => {
    const { fetchMock, events } = setup([], { user: 'teacher' });
    await write(events, 'Pode enviar até sexta.');

    await events.click(await sendButton());

    const item = await within(await section()).findByRole('listitem');
    expect(within(item).getByText('Professor')).toBeVisible();
    expect(within(item).getByText('Você')).toBeVisible();
    expect(postBodies(fetchMock)).toEqual([{ text: 'Pode enviar até sexta.' }]);
  });
});

describe('Comentários: alterações não enviadas (RNF28)', () => {
  it('sem texto não há aviso nem confirmação ao sair', async () => {
    const { events } = setup([]);
    await field();

    expect(
      screen.queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();
    await events.click(screen.getByRole('link', { name: 'Voltar' }));

    await screen.findByRole('heading', { level: 1, name: 'Atividades' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('com texto mostra o aviso no topo do formulário e pede confirmação ao sair', async () => {
    const { events } = setup([]);
    await write(events, 'Rascunho');

    expect(
      await screen.findByText(/Você tem alterações não salvas/),
    ).toBeVisible();
    await events.click(screen.getByRole('link', { name: 'Voltar' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Descartar alterações?',
    });
    await events.click(
      within(dialog).getByRole('button', { name: 'Continuar editando' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect((await field()) as HTMLTextAreaElement).toHaveValue('Rascunho');

    await events.click(screen.getByRole('link', { name: 'Voltar' }));
    await events.click(
      within(
        await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
      ).getByRole('button', { name: 'Sair sem salvar' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Atividades' });
  });

  it('o texto digitado sobrevive à recarga do detalhe, como ao trocar o status', async () => {
    const { events } = setup([], { activity: { status: 'pending' } });
    await write(events, 'Ainda escrevendo');

    await events.click(screen.getByRole('button', { name: 'Em andamento' }));

    await screen.findByText('Status atualizado.');
    expect((await field()) as HTMLTextAreaElement).toHaveValue(
      'Ainda escrevendo',
    );
  });
});

describe('Comentários: estados da atividade e erros', () => {
  it('numa atividade concluída a lista continua e o campo fica desabilitado com o motivo', async () => {
    setup(numbered(2), { activity: { status: 'completed' } });

    const region = await section();

    await within(region).findByText('Comentário 2');
    expect(
      within(region).getByText('Atividade concluída: não é possível comentar'),
    ).toBeVisible();
    expect((await field()) as HTMLTextAreaElement).toBeDisabled();
    expect(
      within(region).queryByRole('button', { name: 'Comentar' }),
    ).toBeNull();
  });

  it('um 409 ao enviar mostra a mensagem do servidor e desabilita o campo, mantendo o texto', async () => {
    const message =
      'Esta atividade já foi concluída e não aceita novos comentários.';
    const { events } = setup([], {
      overrides: { [POST_ROUTE]: { status: 409, body: { detail: message } } },
    });
    await write(events, 'Tarde demais');

    await events.click(await sendButton());

    expect(await screen.findByText(message)).toBeVisible();
    const input = (await field()) as HTMLTextAreaElement;
    expect(input).toBeDisabled();
    expect(input).toHaveValue('Tarde demais');
  });

  it('um 404 ao enviar avisa que a orientação foi encerrada, atualiza a sessão e mantém o texto', async () => {
    const { fetchMock, events } = setup([], {
      overrides: {
        [POST_ROUTE]: {
          status: 404,
          body: { detail: 'Atividade não encontrada.' },
        },
      },
    });
    await write(events, 'Meu texto');
    const reads = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(await sendButton());

    expect(
      await screen.findByText('A orientação foi encerrada.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET /api/auth/me').length).toBeGreaterThan(
        reads,
      ),
    );
    expect((await field()) as HTMLTextAreaElement).toHaveValue('Meu texto');
  });
});
