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
const BAR = 'Progresso do PDF do relatório';

interface FakeExport {
  id: number;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  stage: 'queued' | 'gathering' | 'rendering';
  items_done: number;
  items_total: number;
  created_at: string;
  ready_at: string | null;
  file_name: string | null;
}

function makeExport(overrides: Partial<FakeExport> = {}): FakeExport {
  return {
    id: 1,
    status: 'queued',
    stage: 'queued',
    items_done: 0,
    items_total: 0,
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
    expect(await screen.findByRole('progressbar', { name: BAR })).toBeVisible();

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

    expect(await screen.findByRole('progressbar', { name: BAR })).toBeVisible();
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
    expect(await screen.findByRole('progressbar', { name: BAR })).toBeVisible();
  });
});

/** A região de anúncio própria do bloco (`role="status"`), só com as frases da ficha. */
const announcement = () => screen.getByTestId('report-export-announcer');

function processing(
  stage: FakeExport['stage'],
  done = 0,
  total = 0,
): Partial<FakeExport> {
  return { status: 'processing', stage, items_done: done, items_total: total };
}

describe('AdvisingReportPage: o progresso da exportação por etapas (RF62, ADR 0007)', () => {
  it('mostra as três etapas numeradas, com a contagem na etapa 2, e anuncia só a mudança de etapa', async () => {
    const { state } = exportServer(null);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/aluno/historico/7/relatorio');

    await user.click(
      await screen.findByRole('button', { name: 'Exportar PDF' }),
    );
    expect(await screen.findByText('Etapa 1 de 3: Na fila')).toBeVisible();
    const bar = screen.getByRole('progressbar', { name: BAR });
    expect(bar).toHaveAttribute('aria-valuetext', 'Etapa 1 de 3: Na fila');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(
      screen.getByText(
        'O PDF é montado aos poucos. Você pode sair desta tela: avisaremos por notificação quando ele ficar pronto.',
      ),
    ).toBeVisible();
    expect(announcement()).toHaveTextContent(
      'PDF do relatório pedido. Etapa 1 de 3: na fila.',
    );

    state.current = makeExport(processing('gathering', 3, 12));
    await nextPoll();
    const gathering = 'Etapa 2 de 3: Reunindo reuniões e atividades (3 de 12)';
    expect(await screen.findByText(gathering)).toBeVisible();
    expect(screen.getByRole('progressbar', { name: BAR })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(announcement()).toHaveTextContent(
      'Etapa 2 de 3: reunindo reuniões e atividades.',
    );

    state.current = makeExport(processing('gathering', 6, 12));
    await nextPoll();
    expect(
      await screen.findByText(
        'Etapa 2 de 3: Reunindo reuniões e atividades (6 de 12)',
      ),
    ).toBeVisible();
    expect(announcement()).toHaveTextContent(
      /^Etapa 2 de 3: reunindo reuniões e atividades\.$/,
    );

    state.current = makeExport(processing('rendering', 12, 12));
    await nextPoll();
    expect(
      await screen.findByText('Etapa 3 de 3: Gerando o PDF'),
    ).toBeVisible();
    expect(screen.getByRole('progressbar', { name: BAR })).not.toHaveAttribute(
      'aria-valuenow',
    );
    expect(announcement()).toHaveTextContent('Etapa 3 de 3: gerando o PDF.');
  });

  it('com a aba oculta não consulta a situação, e consulta ao voltar', async () => {
    const { fetchMock } = exportServer(
      makeExport(processing('gathering', 1, 4)),
    );
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    renderApp('/aluno/historico/7/relatorio');
    await screen.findByText(/Etapa 2 de 3/);
    const reads = requestsTo(fetchMock, `GET ${EXPORT}`).length;

    visibility.mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      vi.advanceTimersByTime(EXPORT_POLL_INTERVAL_MS * 5);
    });
    expect(requestsTo(fetchMock, `GET ${EXPORT}`)).toHaveLength(reads);

    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {});
    expect(requestsTo(fetchMock, `GET ${EXPORT}`)).toHaveLength(reads + 1);
  });

  it('o bloco fica no topo, antes do cabeçalho, e explica o que o PDF traz antes do botão', async () => {
    exportServer(null);
    renderApp('/aluno/historico/7/relatorio');

    const button = await screen.findByRole('button', { name: 'Exportar PDF' });
    const support = screen.getByText(
      'O PDF traz o relatório completo: todas as reuniões realizadas e atividades concluídas ou arquivadas, sem o filtro e sem a página escolhidos na tela. Os arquivos entregues não vão no PDF, só os nomes deles.',
    );
    const header = screen.getByRole('heading', { level: 2, name: 'Pessoa 7' });
    const before = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(support, button)).toBe(true);
    expect(before(button, header)).toBe(true);
  });

  it('enquanto o pedido não responde, o botão fica ocupado sem perder o foco', async () => {
    const { fetchMock } = exportServer(null);
    let answer: (value: unknown) => void = () => undefined;
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/aluno/historico/7/relatorio');
    const button = await screen.findByRole('button', { name: 'Exportar PDF' });
    const pending = new Promise((resolve) => {
      answer = resolve;
    });
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === 'POST') await pending;
      return original(input, init);
    });

    await user.click(button);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    await act(async () => {
      answer(undefined);
    });
    expect(await screen.findByText('Etapa 1 de 3: Na fila')).toBeVisible();
  });

  it('quando o pedido falha, avisa com o texto da tela e mantém o botão', async () => {
    const { fetchMock } = exportServer(null);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/aluno/historico/7/relatorio');
    const button = await screen.findByRole('button', { name: 'Exportar PDF' });
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ detail: 'erro' }), { status: 500 })
        : original(input, init),
    );

    await user.click(button);

    expect(
      await screen.findByText(
        'Não foi possível pedir o PDF agora. Tente novamente em alguns instantes.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeVisible();
  });

  it('enquanto a situação carrega, reserva o lugar do bloco', async () => {
    const { fetchMock } = exportServer(null);
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      String(input).endsWith('/exportacao')
        ? new Promise<Response>(() => undefined)
        : original(input, init),
    );
    renderApp('/aluno/historico/7/relatorio');

    await screen.findByRole('heading', { level: 2, name: 'Pessoa 7' });
    expect(screen.getByTestId('report-export-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar PDF' })).toBeNull();
  });
});
