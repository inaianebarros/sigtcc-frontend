import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { commentsServer, makeComment } from '../test/commentsApi';
import type { FakeComment } from '../test/commentsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

const TIMELINE = 'GET /api/atividades/:id/linha-do-tempo';
const TEACHER = { id: 9, full_name: 'Carlos Lima', type: 'teacher' } as const;
const STUDENT = { id: 7, full_name: 'Ana Souza', type: 'student' } as const;

function manyComments(count: number): FakeComment[] {
  return Array.from({ length: count }, (_, position) =>
    makeComment(position + 1, {
      text: `Comentário ${position + 1}`,
      created_at: `2026-11-03T10:${String(position).padStart(2, '0')}:00Z`,
      author: position % 2 === 0 ? STUDENT : TEACHER,
    }),
  );
}

function setup(
  user: 'student' | 'teacher',
  activity: Partial<FakeActivity> = {},
  comments: FakeComment[] = [],
  overrides: Overrides = {},
  control0 = { failFirst: false, failOlder: false },
) {
  const author = user === 'student' ? STUDENT : TEACHER;
  const commentApi = commentsServer(comments, author);
  const server = activitiesServer([makeActivity(5, activity)], {
    user,
    comments: commentApi.comments,
    overrides: overrides as never,
  });
  // O controle faz a leitura da linha do tempo falhar, para os testes de erro e de nova tentativa.
  const control = control0;
  const read = server.routes[TIMELINE] as (
    body: unknown,
    url: URL,
    params: Record<string, string>,
  ) => MockResponse;
  server.routes[TIMELINE] = (body, url, params) => {
    const older = url.searchParams.has('before');
    if ((older && control.failOlder) || (!older && control.failFirst)) {
      return { status: 500, body: {} };
    }
    return read(body, url, params);
  };
  const fetchMock = mockApi({ ...server.routes, ...commentApi.routes });
  const events = userEvent.setup();
  renderApp(
    user === 'student' ? '/aluno/atividades/5' : '/professor/atividades/5',
  );
  return { fetchMock, events, server, control };
}

const observers: ((entries: { isIntersecting: boolean }[]) => void)[] = [];

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  observers.length = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      callback: (entries: { isIntersecting: boolean }[]) => void;
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        this.callback = callback;
        observers.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {
        // Como no navegador, um observador desligado não avisa mais.
        const position = observers.indexOf(this.callback);
        if (position >= 0) observers.splice(position, 1);
      }
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const timeline = () => screen.findByRole('region', { name: 'Linha do tempo' });

function cardTitles(region: HTMLElement): string[] {
  return within(region)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

const loadMore = () =>
  screen.findByRole('button', { name: 'Carregar mais eventos' });

const FULL: Partial<FakeActivity> = {
  title: 'Capítulo 2',
  status: 'in_review',
  student: { id: 7, full_name: 'Ana Souza' },
  teacher: { id: 9, full_name: 'Carlos Lima' },
  created_at: '2026-11-02T14:30:00Z',
  submissions: [
    {
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
    },
    {
      id: 2,
      submitted_at: '2026-11-08T12:00:00Z',
      files: [
        {
          id: 12,
          file_name: 'capitulo2-v2.pdf',
          size_bytes: 2048,
          content_type: 'application/pdf',
        },
      ],
    },
  ],
  reviews: [
    {
      id: 71,
      decision: 'rejected',
      justification: 'Falta a conclusão.',
      decided_at: '2026-11-06T10:00:00Z',
      files: [
        {
          id: 91,
          file_name: 'correcoes.pdf',
          size_bytes: 4096,
          content_type: 'application/pdf',
        },
      ],
    },
  ],
  events: [
    {
      type: 'status_change',
      status: 'in_progress',
      occurred_at: '2026-11-03T09:00:00Z',
    },
    { type: 'sent_for_review', occurred_at: '2026-11-05T12:30:00Z' },
  ],
};

const FULL_COMMENTS = [
  makeComment(1, {
    text: 'Posso entregar amanhã?',
    created_at: '2026-11-04T08:00:00Z',
    author: STUDENT,
  }),
];

describe('Linha do tempo: os cartões', () => {
  it.each(['student', 'teacher'] as const)(
    'o %s vê os eventos do mais recente ao mais antigo, numerados, com o 1 em "Atividade criada"',
    async (user) => {
      setup(user, FULL, FULL_COMMENTS);

      const region = await timeline();
      await within(region).findByText('Atividade criada');

      expect(cardTitles(region)).toEqual([
        'Entrega — Versão 2',
        'Avaliação da versão 1',
        'Enviada para revisão',
        'Entrega — Versão 1',
        'Comentário',
        'Situação alterada para Em andamento',
        'Atividade criada',
      ]);
      expect(
        within(region).getByRole('img', { name: 'Evento 7' }),
      ).toBeVisible();
      expect(
        within(region).getByRole('img', { name: 'Evento 1' }),
      ).toBeVisible();
      expect(within(region).getByText('Mais recente primeiro')).toBeVisible();
    },
  );

  it('mostra em cada cartão a data com hora e o nome de quem agiu', async () => {
    setup('teacher', FULL, FULL_COMMENTS);

    const region = await timeline();
    const created = (
      await within(region).findByText('Atividade criada')
    ).closest('li')!;

    expect(within(created).getByText('Carlos Lima')).toBeVisible();
    expect(within(created).getByText(/2 de novembro de 2026/)).toBeVisible();
    expect(within(created).queryByText(/Descrição/)).not.toBeInTheDocument();
  });

  it('a entrega mostra os arquivos e o selo "Aguardando avaliação" só na mais recente sem decisão depois', async () => {
    setup('teacher', FULL, FULL_COMMENTS);

    const region = await timeline();
    const latest = (
      await within(region).findByText('Entrega — Versão 2')
    ).closest('li')!;
    const first = within(region).getByText('Entrega — Versão 1').closest('li')!;

    expect(within(latest).getByText('capitulo2-v2.pdf')).toBeVisible();
    expect(within(latest).getByText('Aguardando avaliação')).toBeVisible();
    expect(within(first).getByText('capitulo2.pdf')).toBeVisible();
    expect(
      within(first).queryByText('Aguardando avaliação'),
    ).not.toBeInTheDocument();
  });

  it('a avaliação mostra o selo, a justificativa e os anexos do professor', async () => {
    setup('student', FULL, FULL_COMMENTS);

    const region = await timeline();
    const review = (
      await within(region).findByText('Avaliação da versão 1')
    ).closest('li')!;

    expect(within(review).getByText('Recusada')).toBeVisible();
    expect(within(review).getByText('Falta a conclusão.')).toBeVisible();
    expect(within(review).getByText('correcoes.pdf')).toBeVisible();
  });

  it('o aceite mostra o selo Aceita, sem justificativa nem anexos', async () => {
    setup('student', {
      ...FULL,
      status: 'completed',
      reviews: [
        {
          id: 72,
          decision: 'accepted',
          justification: '',
          decided_at: '2026-11-09T10:00:00Z',
          files: [],
        },
      ],
    });

    const region = await timeline();
    const review = (
      await within(region).findByText('Avaliação da versão 2')
    ).closest('li')!;

    expect(within(review).getByText('Aceita')).toBeVisible();
    expect(within(review).queryByRole('button')).not.toBeInTheDocument();
  });

  it('o comentário mostra o texto com as quebras de linha e quem comentou', async () => {
    setup('teacher', FULL, [
      makeComment(1, {
        text: 'Linha um\nLinha dois',
        created_at: '2026-11-04T08:00:00Z',
        author: STUDENT,
      }),
    ]);

    const region = await timeline();
    const card = (await within(region).findByText('Comentário')).closest('li')!;

    const text = within(card).getByText(/Linha um/);
    expect(text.textContent).toBe('Linha um\nLinha dois');
    expect(text).toHaveStyle({ whiteSpace: 'pre-wrap' });
    expect(within(card).getByText('Ana Souza')).toBeVisible();
  });

  it('as seções antigas de entregas, avaliações e comentários não existem mais', async () => {
    setup('teacher', FULL, FULL_COMMENTS);

    await timeline();

    for (const name of ['Entregas', 'Revisões', 'Comentários']) {
      expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();
    }
  });
});

describe('Linha do tempo: baixar os arquivos', () => {
  const saved: string[] = [];

  beforeEach(() => {
    saved.length = 0;
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:arquivo'),
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
  });

  it('baixa o arquivo de uma entrega e o anexo de uma avaliação, cada um pela sua rota', async () => {
    const { fetchMock, events } = setup('student', FULL, FULL_COMMENTS);
    await timeline();

    await events.click(
      await screen.findByRole('button', { name: 'Baixar capitulo2.pdf' }),
    );
    await waitFor(() => expect(saved).toContain('capitulo2.pdf'));
    await events.click(
      screen.getByRole('button', { name: 'Baixar correcoes.pdf' }),
    );
    await waitFor(() => expect(saved).toContain('correcoes.pdf'));

    expect(
      requestsTo(fetchMock, 'GET /api/atividades/5/arquivos/11'),
    ).toHaveLength(1);
    expect(
      requestsTo(fetchMock, 'GET /api/atividades/5/revisoes/71/arquivos/91'),
    ).toHaveLength(1);
  });
});

describe('Linha do tempo: carregar de 10 em 10', () => {
  it('abre com os 10 mais recentes, anuncia a quantidade e carrega mais pelo botão até o início do histórico', async () => {
    const { events } = setup(
      'teacher',
      { status: 'pending' },
      manyComments(24),
    );

    const region = await timeline();
    await within(region).findByText('Comentário 24');

    expect(cardTitles(region)).toHaveLength(10);
    expect(
      within(region).getByText('10 de 25 eventos carregados'),
    ).toBeVisible();
    expect(
      within(region).queryByText('Início do histórico'),
    ).not.toBeInTheDocument();

    await events.click(await loadMore());
    await within(region).findByText('20 de 25 eventos carregados');
    expect(cardTitles(region)).toHaveLength(20);

    await events.click(await loadMore());
    await within(region).findByText('Início do histórico');
    expect(cardTitles(region)).toHaveLength(25);
    expect(
      within(region).getByText('25 de 25 eventos carregados'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Carregar mais eventos' }),
    ).not.toBeInTheDocument();
    expect(cardTitles(region).at(-1)).toBe('Atividade criada');
  });

  it('carrega mais sozinho quando a lista chega perto do fim', async () => {
    setup('teacher', { status: 'pending' }, manyComments(24));
    const region = await timeline();
    await within(region).findByText('Comentário 24');

    act(() => observers.at(-1)!([{ isIntersecting: true }]));

    await within(region).findByText('20 de 25 eventos carregados');
    expect(cardTitles(region)).toHaveLength(20);
  });

  it('mostra o indicador de carregamento enquanto traz mais eventos', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { events } = setup(
      'teacher',
      { status: 'pending' },
      manyComments(24),
    );
    const region = await timeline();
    await within(region).findByText('Comentário 24');
    vi.stubGlobal('fetch', (() =>
      gate.then(() => new Response('{}', { status: 500 }))) as never);

    await events.click(await loadMore());

    expect(
      await within(region).findByRole('progressbar', {
        name: 'Carregando mais eventos',
      }),
    ).toBeVisible();
    release();
  });

  it('um erro ao carregar mais mostra a mensagem, mantém o que já estava e deixa tentar de novo', async () => {
    const control = { failFirst: false, failOlder: true };
    const { events } = setup(
      'teacher',
      { status: 'pending' },
      manyComments(24),
      {},
      control,
    );
    const region = await timeline();
    await within(region).findByText('Comentário 24');

    await events.click(await loadMore());

    expect(
      await within(region).findByText(/Não foi possível carregar mais eventos/),
    ).toBeVisible();
    expect(cardTitles(region)).toHaveLength(10);
    control.failOlder = false;
    await events.click(await loadMore());
    await within(region).findByText('20 de 25 eventos carregados');
  });

  it('o carregamento automático não insiste depois de uma falha', async () => {
    const control = { failFirst: false, failOlder: true };
    const { fetchMock } = setup(
      'teacher',
      { status: 'pending' },
      manyComments(24),
      {},
      control,
    );
    const region = await timeline();
    await within(region).findByText('Comentário 24');

    act(() => observers.at(-1)!([{ isIntersecting: true }]));
    await within(region).findByText(/Não foi possível carregar mais eventos/);
    // Sem observador depois da falha: só o botão tenta de novo.
    expect(observers).toHaveLength(0);

    expect(
      requestsTo(fetchMock, 'GET /api/atividades/5/linha-do-tempo').filter(
        ([input]) => String(input).includes('before='),
      ),
    ).toHaveLength(1);
  });
});

describe('Linha do tempo: comentar e agir', () => {
  it('o campo de novo comentário fica no topo, antes dos cartões', async () => {
    setup('teacher', FULL, FULL_COMMENTS);

    const region = await timeline();
    const field = within(region).getByLabelText('Novo comentário');
    const first = await within(region).findByText('Entrega — Versão 2');

    expect(
      field.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('depois de comentar, o evento novo aparece no topo, e o campo é limpo', async () => {
    const { events } = setup('student', FULL, FULL_COMMENTS);
    const region = await timeline();
    await within(region).findByText('Atividade criada');

    await events.type(
      within(region).getByLabelText('Novo comentário'),
      'Comentário novo',
    );
    await events.click(
      within(region).getByRole('button', { name: 'Comentar' }),
    );

    await waitFor(() => expect(cardTitles(region)[0]).toBe('Comentário'));
    expect(within(region).getByText('Comentário novo')).toBeVisible();
    expect(within(region).getByLabelText('Novo comentário')).toHaveValue('');
    expect(within(region).getByRole('img', { name: 'Evento 8' })).toBeVisible();
  });

  it('depois de mudar a situação, o evento novo aparece no topo', async () => {
    const { events } = setup('student', {
      status: 'pending',
      created_at: '2026-11-02T14:30:00Z',
    });
    const region = await timeline();
    await within(region).findByText('Atividade criada');

    await events.click(screen.getByRole('button', { name: 'Em andamento' }));

    // A ação recarrega o detalhe, e a linha do tempo é lida de novo: busca a região outra vez.
    await waitFor(() =>
      expect(
        cardTitles(screen.getByRole('region', { name: 'Linha do tempo' }))[0],
      ).toBe('Situação alterada para Em andamento'),
    );
  });

  it('a posição da rolagem não vai para a URL', async () => {
    const { events } = setup(
      'teacher',
      { status: 'pending' },
      manyComments(24),
    );
    const region = await timeline();
    await within(region).findByText('Comentário 24');

    await events.click(await loadMore());
    await within(region).findByText('20 de 25 eventos carregados');

    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });
});

describe('Linha do tempo: carregamento e erro', () => {
  it('mostra um carregamento próprio enquanto lê, sem esconder o cabeçalho nem as ações', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setup('teacher', FULL, FULL_COMMENTS, {
      [TIMELINE]: async () => {
        await gate;
        return { body: { items: [], count: 0, has_more: false } };
      },
    });

    const region = await timeline();

    expect(
      within(region).getByRole('progressbar', {
        name: 'Carregando a linha do tempo',
      }),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: 'Ações' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Descrição' })).toBeVisible();
    release();
  });

  it('um erro mostra a mensagem com Tentar novamente, sem derrubar o cabeçalho nem as ações, e a nova tentativa funciona', async () => {
    const control = { failFirst: true, failOlder: false };
    const { events } = setup('teacher', FULL, FULL_COMMENTS, {}, control);
    const region = await timeline();

    expect(await within(region).findByRole('alert')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Ações' })).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Resumo da atividade' }),
    ).toBeVisible();

    control.failFirst = false;
    await events.click(
      within(region).getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await within(region).findByText('Atividade criada')).toBeVisible();
  });

  it('numa atividade só com a criação mostra um evento e o início do histórico', async () => {
    setup('student', { status: 'pending' });

    const region = await timeline();

    expect(await within(region).findByText('Atividade criada')).toBeVisible();
    expect(within(region).getByText('Início do histórico')).toBeVisible();
  });
});
