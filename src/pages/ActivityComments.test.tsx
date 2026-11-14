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

const POST = 'POST /api/atividades/5/comentarios';
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
  const server = commentsServer(
    comments,
    user === 'student' ? STUDENT_AUTHOR : TEACHER_AUTHOR,
    overrides as never,
  );
  const activities = activitiesServer(
    [makeActivity(5, { comments_count: comments.length, ...activity })],
    { user, comments: server.comments },
  );
  const fetchMock = mockApi({ ...activities.routes, ...server.routes });
  const events = userEvent.setup({ applyAccept: false });
  renderApp(
    user === 'student' ? '/aluno/atividades/5' : '/professor/atividades/5',
  );
  return { fetchMock, events, server };
}

const section = () => screen.findByRole('region', { name: 'Linha do tempo' });
const field = () => screen.findByLabelText(/Novo comentário/);
const sendButton = () => screen.findByRole('button', { name: 'Comentar' });

function postBodies(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, POST).map(
    ([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>,
  );
}

async function write(events: ReturnType<typeof userEvent.setup>, text: string) {
  await events.click(await field());
  await events.paste(text);
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
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

  it('enviar manda o texto sem as pontas, limpa o campo e põe o comentário no topo da linha do tempo', async () => {
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
    const top = within(region).getAllByRole('listitem')[0]!;
    expect(within(top).getByText(/Primeira linha/)).toBeVisible();
    expect(within(top).getByText('Você')).toBeVisible();
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
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/Novo comentário/) as HTMLTextAreaElement).value,
      ).toBe(''),
    );
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

    const region = await section();
    const item = (
      await within(region).findByText('Pode enviar até sexta.')
    ).closest('li')!;
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
  it('numa atividade concluída a linha do tempo continua e o campo fica desabilitado com o motivo', async () => {
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
    // O texto mantido ainda pede confirmação ao sair, então o aviso do topo continua à vista.
    expect(screen.getByText(/Você tem alterações não salvas/)).toBeVisible();
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
