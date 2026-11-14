import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const DOWNLOAD = 'GET /api/atividades/:id/revisoes/:reviewId/arquivos/:fileId';

const ATTACHED = [
  {
    id: 71,
    file_name: 'correcoes.pdf',
    size_bytes: 1536,
    content_type: 'application/pdf',
  },
  {
    id: 72,
    file_name: 'versão corrigida.zip',
    size_bytes: 3 * 1024 * 1024,
    content_type: 'application/zip',
  },
];

const REVIEWS: FakeActivity['reviews'] = [
  {
    id: 1,
    decision: 'rejected',
    justification: 'Veja as correções anexas.',
    decided_at: '2026-11-06T10:00:00Z',
    files: ATTACHED,
  },
  {
    id: 2,
    decision: 'rejected',
    justification: 'Só texto.',
    decided_at: '2026-11-07T10:00:00Z',
    files: [],
  },
  {
    id: 3,
    decision: 'accepted',
    justification: '',
    decided_at: '2026-11-08T10:00:00Z',
    files: [],
  },
];

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup(
  user: 'student' | 'teacher' = 'student',
  overrides: Overrides = {},
  activity: Partial<FakeActivity> = {},
) {
  const server = activitiesServer(
    [makeActivity(5, { status: 'pending', reviews: REVIEWS, ...activity })],
    { user, overrides: overrides as never },
  );
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(
    user === 'student' ? '/aluno/atividades/5' : '/professor/atividades/5',
  );
  return { fetchMock, events };
}

const saved: { href: string; download: string }[] = [];
let createdBlobs: Blob[] = [];
const createObjectURL = vi.fn((blob: Blob) => {
  createdBlobs.push(blob);
  return `blob:anexo-${createdBlobs.length}`;
});
const revokeObjectURL = vi.fn();

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  saved.length = 0;
  createdBlobs = [];
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL, revokeObjectURL }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const history = () => screen.findByRole('region', { name: 'Revisões' });
const downloadButton = (name: string) =>
  screen.findByRole('button', { name: `Baixar ${name}` });

describe('Revisões: os anexos da recusa', () => {
  it.each(['student', 'teacher'] as const)(
    'o %s vê nome, tamanho e tipo de cada anexo dentro da decisão que o trouxe',
    async (user) => {
      setup(user);

      const items = within(await history()).getAllByRole('listitem', {
        name: '',
      });
      const first = items.find((item) =>
        item.textContent?.includes('Veja as correções anexas.'),
      )!;

      expect(within(first).getByText('correcoes.pdf')).toBeVisible();
      expect(within(first).getByText(/1,5 KB, application\/pdf/)).toBeVisible();
      expect(within(first).getByText('versão corrigida.zip')).toBeVisible();
      expect(within(first).getByText(/3,0 MB, application\/zip/)).toBeVisible();
      expect(
        within(first).getByRole('list', { name: 'Anexos da recusa' }),
      ).toBeVisible();
    },
  );

  it('a recusa sem arquivos e o aceite ficam como hoje, sem lista de anexos', async () => {
    setup();

    const section = await history();

    expect(within(section).getByText('Só texto.')).toBeVisible();
    expect(within(section).getByText(/Aceita em/)).toBeVisible();
    expect(
      within(section).getAllByRole('list', { name: 'Anexos da recusa' }),
    ).toHaveLength(1);
    expect(within(section).queryByText(/Nenhum anexo/)).not.toBeInTheDocument();
  });

  it('a decisão antiga mantém os anexos depois de um novo envio para revisão', async () => {
    setup(
      'student',
      {},
      {
        status: 'in_review',
        reviews: [REVIEWS[0]!],
        submissions: [
          {
            id: 2,
            submitted_at: '2026-11-09T12:00:00Z',
            files: [
              {
                id: 21,
                file_name: 'nova-entrega.pdf',
                size_bytes: 100,
                content_type: 'application/pdf',
              },
            ],
          },
        ],
      },
    );

    const section = await history();

    expect(within(section).getByText('correcoes.pdf')).toBeVisible();
  });

  it.each(['student', 'teacher'] as const)(
    'o %s baixa o anexo por requisição autenticada, com o nome original',
    async (user) => {
      const { fetchMock, events } = setup(user);

      await events.click(await downloadButton('versão corrigida.zip'));

      await waitFor(() => expect(saved).toHaveLength(1));
      const requests = requestsTo(
        fetchMock,
        'GET /api/atividades/5/revisoes/1/arquivos/72',
      );
      expect(requests).toHaveLength(1);
      expect(
        (requests[0]![1]?.headers as Headers).get('Authorization'),
      ).toMatch(/^Bearer /);
      expect(saved[0]).toEqual({
        href: 'blob:anexo-1',
        download: 'versão corrigida.zip',
      });
      expect(await createdBlobs[0]!.text()).toBe(
        'conteúdo de versão corrigida.zip',
      );
      await waitFor(() =>
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:anexo-1'),
      );
    },
  );

  it('mostra o carregando só no anexo que está sendo baixado', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { events } = setup('student', {
      [DOWNLOAD]: async () => {
        await gate;
        return { rawBody: 'conteúdo' };
      },
    });

    await events.click(await downloadButton('correcoes.pdf'));

    expect(
      await screen.findByRole('button', { name: 'Baixando correcoes.pdf' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Baixar versão corrigida.zip' }),
    ).toBeEnabled();
    release();
    await waitFor(() => expect(saved).toHaveLength(1));
  });

  it.each([
    [404, 'O arquivo não foi encontrado.'],
    [503, 'Não foi possível obter o arquivo. Tente novamente.'],
  ])(
    'um %i no download mostra uma mensagem informativa e deixa tentar de novo',
    async (status, message) => {
      const { events } = setup('student', {
        [DOWNLOAD]: { status, body: { detail: message } },
      });

      await events.click(await downloadButton('correcoes.pdf'));

      expect(await screen.findByText(message)).toBeVisible();
      expect(saved).toHaveLength(0);
      expect(await downloadButton('correcoes.pdf')).toBeEnabled();
    },
  );

  it('baixa só pelo teclado: o botão de baixar recebe foco e Enter baixa', async () => {
    const { events } = setup();
    const button = await downloadButton('correcoes.pdf');

    button.focus();
    await events.keyboard('{Enter}');

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.download).toBe('correcoes.pdf');
  });
});
