import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_POLL_INTERVAL_MS } from '../advisingReport/ReportExport';
import { tokenStore } from '../services/tokenStore';
import { makeAdvisingReport, reportRoutes } from '../test/advisingReportApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const EXPORT = '/api/orientacao/historico/7/exportacao';

interface FakeExport {
  id: number;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  created_at: string;
  ready_at: string | null;
  file_name: string | null;
}

function makeExport(overrides: Partial<FakeExport> = {}): FakeExport {
  return {
    id: 1,
    status: 'queued',
    created_at: '2026-11-20T14:00:00Z',
    ready_at: null,
    file_name: null,
    ...overrides,
  };
}

const READY = {
  status: 'ready' as const,
  ready_at: '2026-11-20T14:00:10Z',
  file_name: 'relatorio-orientacao-ana-2026-11-02.pdf',
};

/** O servidor da exportação: a exportação atual de quem pede, que o teste muda à vontade. */
function exportServer(
  initial: FakeExport | null,
  user: 'student' | 'teacher' = 'student',
) {
  const state = { current: initial };
  const routes = {
    ...reportRoutes([makeAdvisingReport(7)], user),
    [`GET ${EXPORT}`]: () => ({ body: state.current }),
    [`POST ${EXPORT}`]: () => {
      state.current = makeExport();
      return { status: 202, body: state.current };
    },
    [`GET ${EXPORT}/pdf`]: () => ({
      rawBody: '%PDF-1.7',
      headers: { 'Content-Type': 'application/pdf' },
    }),
  };
  return { state, fetchMock: mockApi(routes) };
}

async function nextPoll() {
  await act(async () => {});
  await act(async () => {
    vi.advanceTimersByTime(EXPORT_POLL_INTERVAL_MS);
  });
}

const saved: { download: string }[] = [];

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  saved.length = 0;
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:relatorio'),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ download: this.download });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AdvisingReportPage: exportar o relatório em PDF (RF62, RN50)', () => {
  it('pede a exportação, acompanha a geração a cada 2 s e baixa o PDF quando fica pronto', async () => {
    const { state, fetchMock } = exportServer(null);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/aluno/historico/7/relatorio');

    await user.click(
      await screen.findByRole('button', { name: 'Exportar PDF' }),
    );

    expect(requestsTo(fetchMock, `POST ${EXPORT}`)).toHaveLength(1);
    expect(
      await screen.findByRole('progressbar', { name: 'Gerando o PDF' }),
    ).toBeVisible();

    state.current = makeExport({ status: 'processing' });
    await nextPoll();
    expect(screen.getByRole('progressbar')).toBeVisible();

    state.current = makeExport(READY);
    await nextPoll();
    await user.click(await screen.findByRole('button', { name: 'Baixar PDF' }));

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(saved).toEqual([
      { download: 'relatorio-orientacao-ana-2026-11-02.pdf' },
    ]);
    const polls = requestsTo(fetchMock, `GET ${EXPORT}`).length;
    await nextPoll();
    expect(requestsTo(fetchMock, `GET ${EXPORT}`)).toHaveLength(polls);
  });

  it('ao abrir com um PDF já pronto, oferece o download sem gerar de novo', async () => {
    const { fetchMock } = exportServer(makeExport(READY));
    renderApp('/aluno/historico/7/relatorio');

    expect(
      await screen.findByRole('button', { name: 'Baixar PDF' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Exportar PDF' })).toBeNull();
    expect(requestsTo(fetchMock, `POST ${EXPORT}`)).toHaveLength(0);
  });

  it('ao abrir com uma exportação em andamento, mostra a geração e continua acompanhando', async () => {
    const { state } = exportServer(
      makeExport({ status: 'processing' }),
      'teacher',
    );
    renderApp('/professor/historico/7/relatorio');

    expect(
      await screen.findByRole('progressbar', { name: 'Gerando o PDF' }),
    ).toBeVisible();
    state.current = makeExport(READY);
    await nextPoll();
    expect(
      await screen.findByRole('button', { name: 'Baixar PDF' }),
    ).toBeVisible();
  });

  it('quando a geração falha, avisa e deixa pedir de novo', async () => {
    const { fetchMock } = exportServer(makeExport({ status: 'failed' }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/aluno/historico/7/relatorio');

    expect(
      await screen.findByText('Não foi possível gerar o PDF.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(requestsTo(fetchMock, `POST ${EXPORT}`)).toHaveLength(1);
    expect(
      await screen.findByRole('progressbar', { name: 'Gerando o PDF' }),
    ).toBeVisible();
  });
});
