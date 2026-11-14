import { createTheme } from '@mui/material';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { commentsServer } from '../test/commentsApi';
import { contrast, opaque } from '../test/contrast';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const LONG_DESCRIPTION = [
  'Primeiro parágrafo da descrição, com o que o professor pede.',
  'Segundo parágrafo: referências, formato e critérios. '.repeat(12).trim(),
  'Último parágrafo, que não pode ser cortado.',
].join('\n\n');

const BASE: Partial<FakeActivity> = {
  title: 'Capítulo 2',
  description: LONG_DESCRIPTION,
  deadline: '2026-12-31',
  status: 'in_review',
  overdue: true,
  student: { id: 101, full_name: 'Maria Lima' },
  teacher: { id: 9, full_name: 'Carlos Lima' },
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
};

function setup(
  user: 'student' | 'teacher',
  activity: Partial<FakeActivity> = {},
) {
  const server = activitiesServer([makeActivity(5, { ...BASE, ...activity })], {
    user,
  });
  const comments = commentsServer(
    [],
    user === 'student'
      ? { id: 7, full_name: 'Ana Souza', type: 'student' }
      : { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
  );
  const fetchMock = mockApi({ ...server.routes, ...comments.routes });
  const events = userEvent.setup();
  renderApp(
    user === 'student' ? '/aluno/atividades/5' : '/professor/atividades/5',
  );
  return { fetchMock, events };
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

const header = () =>
  screen.findByRole('region', { name: 'Resumo da atividade' });
const description = () => screen.findByRole('region', { name: 'Descrição' });
const actions = () => screen.findByRole('region', { name: 'Ações' });

describe('Detalhe da atividade: o cabeçalho', () => {
  it.each(['student', 'teacher'] as const)(
    'o %s vê o título, a situação, o prazo com o selo Atrasada, o aluno e o orientador',
    async (user) => {
      setup(user);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Capítulo 2' }),
      ).toBeVisible();
      const summary = await header();
      expect(within(summary).getByText('Em revisão')).toBeVisible();
      expect(within(summary).getByText('Atrasada')).toBeVisible();
      expect(within(summary).getByText('31 de dezembro de 2026')).toBeVisible();
      expect(within(summary).getByText('Maria Lima')).toBeVisible();
      expect(within(summary).getByText('Carlos Lima')).toBeVisible();
    },
  );

  it('sem o selo quando o servidor não diz que está atrasada, e sem orientador quando ele não vem', async () => {
    setup('student', { overdue: false, teacher: null });

    const summary = await header();

    expect(within(summary).queryByText('Atrasada')).not.toBeInTheDocument();
    expect(within(summary).queryByText('Orientador')).not.toBeInTheDocument();
  });
});

describe('Detalhe da atividade: a Descrição fixa', () => {
  it.each(['student', 'teacher'] as const)(
    'o %s vê a descrição inteira, com as quebras de linha, num bloco próprio',
    async (user) => {
      setup(user);

      const block = await description();

      const paragraphs = within(block).getByText(/Primeiro parágrafo/);
      expect(paragraphs.textContent).toBe(LONG_DESCRIPTION);
      expect(paragraphs).toHaveStyle({ whiteSpace: 'pre-wrap' });
      expect(within(block).getByText(/Último parágrafo/)).toBeVisible();
    },
  );

  it('depois de editar, a Descrição mostra o texto novo', async () => {
    const { events } = setup('teacher', { status: 'pending' });
    await events.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar atividade',
    });
    const field = within(dialog).getByLabelText(/Descrição/);
    await events.clear(field);
    await events.type(field, 'Texto novo da descrição');

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Descrição' })).getByText(
          'Texto novo da descrição',
        ),
      ).toBeVisible(),
    );
  });

  it('o texto lê-se com contraste mínimo de 4,5:1 sobre o fundo do bloco', () => {
    const { text, action } = createTheme().palette;
    const white: [number, number, number] = [255, 255, 255];

    expect(
      contrast(opaque(text.primary, white), opaque(action.hover, white)),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Detalhe da atividade: a faixa Ações', () => {
  it('o professor tem Editar, Excluir, Aceitar e Recusar na faixa, com a atividade em revisão', async () => {
    setup('teacher');

    const strip = await actions();

    for (const name of ['Editar', 'Excluir', 'Aceitar', 'Recusar']) {
      expect(within(strip).getByRole('button', { name })).toBeVisible();
    }
  });

  it('o professor não vê Aceitar nem Recusar fora da revisão', async () => {
    setup('teacher', { status: 'pending' });

    const strip = await actions();

    expect(within(strip).getByRole('button', { name: 'Editar' })).toBeVisible();
    expect(
      within(strip).queryByRole('button', { name: 'Aceitar' }),
    ).not.toBeInTheDocument();
  });

  it('o aluno tem a situação, Entregar arquivos e Enviar para revisão na faixa', async () => {
    setup('student', { status: 'in_progress' });

    const strip = await actions();

    expect(
      within(strip).getByRole('group', { name: 'Status da atividade' }),
    ).toBeVisible();
    expect(
      within(strip).getByRole('button', { name: 'Entregar arquivos' }),
    ).toBeVisible();
    expect(
      within(strip).getByRole('button', { name: 'Enviar para revisão' }),
    ).toBeVisible();
    expect(
      within(strip).queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument();
  });
});

describe('Detalhe da atividade: a ordem das áreas', () => {
  it.each(['student', 'teacher'] as const)(
    'o %s vê cabeçalho, Descrição, Ações e depois a Linha do tempo',
    async (user) => {
      setup(user);

      const regions = [
        await header(),
        await description(),
        await actions(),
        await screen.findByRole('region', { name: 'Linha do tempo' }),
      ];

      regions.slice(1).forEach((region, index) => {
        expect(
          regions[index]!.compareDocumentPosition(region) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      });
    },
  );

  it('no celular as quatro primeiras áreas continuam à vista', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup('teacher');

    expect(await header()).toBeVisible();
    expect(await description()).toBeVisible();
    expect(await actions()).toBeVisible();
  });
});
