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

const DOWNLOAD = 'GET /api/atividades/:id/arquivos/:fileId';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

const WITH_FILES = makeActivity(5, {
  status: 'in_review',
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
        {
          id: 12,
          file_name: 'relatório final.zip',
          size_bytes: 3 * 1024 * 1024,
          content_type: 'application/zip',
        },
      ],
    },
  ],
});

function setup(
  user: 'student' | 'teacher' = 'student',
  overrides: Overrides = {},
  activity: FakeActivity = WITH_FILES,
) {
  const server = activitiesServer([activity], {
    user,
    overrides: overrides as never,
  });
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
  return `blob:arquivo-${createdBlobs.length}`;
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

const downloadButton = (name: string) =>
  screen.findByRole('button', { name: `Baixar ${name}` });

describe('Entregas: baixar um arquivo', () => {
  it.each(['student', 'teacher'] as const)(
    'o %s baixa o arquivo por requisição autenticada, com o nome original',
    async (user) => {
      const { fetchMock, events } = setup(user);

      await events.click(await downloadButton('capitulo2.pdf'));

      await waitFor(() => expect(saved).toHaveLength(1));
      const requests = requestsTo(
        fetchMock,
        'GET /api/atividades/5/arquivos/11',
      );
      expect(requests).toHaveLength(1);
      expect(
        new URL(String(requests[0]![0]), 'http://localhost').pathname,
      ).toBe('/api/atividades/5/arquivos/11');
      expect(
        (requests[0]![1]?.headers as Headers).get('Authorization'),
      ).toMatch(/^Bearer /);
      expect(saved[0]).toEqual({
        href: 'blob:arquivo-1',
        download: 'capitulo2.pdf',
      });
      expect(await createdBlobs[0]!.text()).toBe('conteúdo de capitulo2.pdf');
      await waitFor(() =>
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:arquivo-1'),
      );
    },
  );

  it('guarda o nome original com acentos e espaços', async () => {
    const { events } = setup();

    await events.click(await downloadButton('relatório final.zip'));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.download).toBe('relatório final.zip');
  });

  it('mostra o carregando só no arquivo que está sendo baixado', async () => {
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

    await events.click(await downloadButton('capitulo2.pdf'));

    const loading = await screen.findByRole('button', {
      name: 'Baixando capitulo2.pdf',
    });
    expect(loading).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Baixar relatório final.zip' }),
    ).toBeEnabled();
    release();
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(await downloadButton('capitulo2.pdf')).toBeEnabled();
  });

  it('um 404 mostra que o arquivo não foi encontrado e deixa tentar de novo', async () => {
    const { events } = setup('student', {
      [DOWNLOAD]: { status: 404, body: { detail: 'Arquivo não encontrado.' } },
    });

    await events.click(await downloadButton('capitulo2.pdf'));

    expect(
      await screen.findByText('O arquivo não foi encontrado.'),
    ).toBeVisible();
    expect(saved).toHaveLength(0);
    expect(await downloadButton('capitulo2.pdf')).toBeEnabled();
  });

  it('uma falha do servidor mostra a mensagem e deixa tentar de novo', async () => {
    const { events } = setup('student', {
      [DOWNLOAD]: {
        status: 503,
        body: { detail: 'Não foi possível obter o arquivo. Tente novamente.' },
      },
    });

    await events.click(await downloadButton('capitulo2.pdf'));

    expect(
      await screen.findByText(
        'Não foi possível obter o arquivo. Tente novamente.',
      ),
    ).toBeVisible();
    expect(await downloadButton('capitulo2.pdf')).toBeEnabled();
  });

  it('a lista de Entregas mostra o nome, o tamanho e o tipo de cada arquivo', async () => {
    setup();

    const section = await screen.findByRole('region', { name: 'Entregas' });

    expect(within(section).getByText('capitulo2.pdf')).toBeVisible();
    expect(within(section).getByText(/1,5 KB, application\/pdf/)).toBeVisible();
    expect(within(section).getByText(/3,0 MB, application\/zip/)).toBeVisible();
  });
});
