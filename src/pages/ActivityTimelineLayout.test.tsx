import { createTheme } from '@mui/material';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { commentsServer, makeComment } from '../test/commentsApi';
import type { FakeComment } from '../test/commentsApi';
import { contrast, opaque } from '../test/contrast';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const TEACHER = { id: 9, full_name: 'Carlos Lima', type: 'teacher' } as const;
const STUDENT = { id: 7, full_name: 'Ana Souza', type: 'student' } as const;

const ACTIVITY: Partial<FakeActivity> = {
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
  ],
  reviews: [
    {
      id: 71,
      decision: 'rejected',
      justification: 'Falta a conclusão.',
      decided_at: '2026-11-06T10:00:00Z',
      files: [],
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

const COMMENTS: FakeComment[] = [
  makeComment(1, {
    text: 'Dúvida da aluna',
    created_at: '2026-11-04T08:00:00Z',
    author: STUDENT,
  }),
  makeComment(2, {
    text: 'Resposta do professor',
    created_at: '2026-11-04T09:00:00Z',
    author: TEACHER,
  }),
];

function setup(
  width: number,
  {
    comments = COMMENTS,
    overrides = {},
  }: { comments?: FakeComment[]; overrides?: Record<string, never> } = {},
) {
  setViewportWidth(width);
  const commentApi = commentsServer(comments, STUDENT);
  const server = activitiesServer([makeActivity(5, ACTIVITY)], {
    user: 'student',
    comments: commentApi.comments,
    overrides,
  });
  mockApi({ ...server.routes, ...commentApi.routes });
  renderApp('/aluno/atividades/5');
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
});

const timeline = async () => {
  const region = await screen.findByRole('region', { name: 'Linha do tempo' });
  await within(region).findByText('Atividade criada');
  return region;
};

function titles(region: HTMLElement): string[] {
  return within(region)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

/** Os cartões na ordem do documento, com o título e o lado em que o evento fica. */
function sides(region: HTMLElement): [string, string | null][] {
  return within(region)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => [
      heading.textContent ?? '',
      heading.closest('li')!.getAttribute('data-side'),
    ]);
}

const ORDER = [
  'Avaliação da versão 1',
  'Enviada para revisão',
  'Entrega — Versão 1',
  'Comentário',
  'Comentário',
  'Situação alterada para Em andamento',
  'Atividade criada',
];

describe('Linha do tempo: duas colunas a partir de 600 px', () => {
  it.each([600, DESKTOP_WIDTH])(
    'com %i px, o professor fica à esquerda, o aluno à direita e os números no centro',
    async (width) => {
      setup(width);

      const region = await timeline();

      const list = within(region).getByRole('list', {
        name: 'Eventos da atividade',
      });
      expect(list).toHaveAttribute('data-layout', 'split');
      expect(sides(region)).toEqual([
        ['Avaliação da versão 1', 'teacher'],
        ['Enviada para revisão', 'student'],
        ['Entrega — Versão 1', 'student'],
        ['Comentário', 'teacher'],
        ['Comentário', 'student'],
        ['Situação alterada para Em andamento', 'student'],
        ['Atividade criada', 'teacher'],
      ]);
      const [first] = within(list).getAllByRole('listitem');
      expect(first).toHaveStyle({ display: 'grid' });
      expect(
        within(first!).getByRole('img', { name: 'Evento 7' }),
      ).toBeVisible();
    },
  );

  it('o cartão do professor ocupa a coluna da esquerda e o do aluno, a da direita', async () => {
    setup(DESKTOP_WIDTH);

    const region = await timeline();
    const teacherCard = within(region)
      .getByText('Avaliação da versão 1')
      .closest('[data-card]')!;
    const studentCard = within(region)
      .getByText('Enviada para revisão')
      .closest('[data-card]')!;

    expect(teacherCard).toHaveStyle({ gridColumn: '1' });
    expect(studentCard).toHaveStyle({ gridColumn: '3' });
  });

  it('o campo de comentário e o fim do histórico seguem à vista', async () => {
    setup(DESKTOP_WIDTH);

    const region = await timeline();

    expect(within(region).getByLabelText('Novo comentário')).toBeVisible();
    expect(within(region).getByText('Início do histórico')).toBeVisible();
    expect(within(region).getByText('7 de 7 eventos carregados')).toBeVisible();
  });
});

describe('Linha do tempo: carregar mais e erro nas duas colunas', () => {
  const many = Array.from({ length: 20 }, (_, position) =>
    makeComment(position + 1, {
      text: `Comentário ${position + 1}`,
      created_at: `2026-11-04T10:${String(position).padStart(2, '0')}:00Z`,
      author: position % 2 === 0 ? STUDENT : TEACHER,
    }),
  );

  it.each([DESKTOP_WIDTH, PHONE_WIDTH])(
    'com %i px, o botão Carregar mais eventos traz os próximos e mantém os lados',
    async (width) => {
      setup(width, { comments: many });
      const region = await screen.findByRole('region', {
        name: 'Linha do tempo',
      });
      await within(region).findByText('10 de 25 eventos carregados');
      const events = userEvent.setup();

      expect(titles(region)).toHaveLength(10);
      await events.click(
        within(region).getByRole('button', { name: 'Carregar mais eventos' }),
      );

      await within(region).findByText('20 de 25 eventos carregados');
      const loaded = sides(region);
      expect(loaded).toHaveLength(20);
      if (width === DESKTOP_WIDTH) {
        expect(loaded.every(([, side]) => side !== null)).toBe(true);
      }
    },
  );

  it('o erro de leitura mostra Tentar novamente também no layout largo', async () => {
    setup(DESKTOP_WIDTH, {
      overrides: {
        'GET /api/atividades/:id/linha-do-tempo': {
          status: 500,
          body: {},
        } as never,
      },
    });

    const region = await screen.findByRole('region', {
      name: 'Linha do tempo',
    });

    expect(await within(region).findByRole('alert')).toBeVisible();
    expect(
      within(region).getByRole('button', { name: 'Tentar novamente' }),
    ).toBeVisible();
  });
});

describe('Linha do tempo: uma coluna abaixo de 600 px', () => {
  it.each([599, PHONE_WIDTH])(
    'com %i px, os cartões ficam empilhados em uma coluna, sem lados',
    async (width) => {
      setup(width);

      const region = await timeline();

      const list = within(region).getByRole('list', {
        name: 'Eventos da atividade',
      });
      expect(list).toHaveAttribute('data-layout', 'stacked');
      expect(sides(region).map(([, side]) => side)).toEqual(
        Array(7).fill(null),
      );
      const [first] = within(list).getAllByRole('listitem');
      expect(first).not.toHaveStyle({ display: 'grid' });
    },
  );

  it('o campo de comentário e o fim do histórico seguem à vista', async () => {
    setup(PHONE_WIDTH);

    const region = await timeline();

    expect(within(region).getByLabelText('Novo comentário')).toBeVisible();
    expect(within(region).getByText('Início do histórico')).toBeVisible();
  });
});

describe('Linha do tempo: a mesma ordem nos dois layouts', () => {
  it('os eventos vêm na mesma ordem, e é a que o leitor de tela percorre', async () => {
    setup(DESKTOP_WIDTH);
    const wide = titles(await timeline());
    document.body.innerHTML = '';

    setup(PHONE_WIDTH);
    const narrow = titles(await timeline());

    expect(wide).toEqual(ORDER);
    expect(narrow).toEqual(ORDER);
  });
});

describe('Linha do tempo: contraste dos números (WCAG 2.1 AA)', () => {
  const { primary, secondary } = createTheme().palette;
  const white: [number, number, number] = [255, 255, 255];

  it.each([
    ['do professor', primary],
    ['do aluno', secondary],
  ])('o número %s lê-se sobre o círculo', (_who, color) => {
    expect(
      contrast(opaque(color.contrastText, white), opaque(color.dark, white)),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
