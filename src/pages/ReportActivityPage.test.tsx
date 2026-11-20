import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFRESH_INTERVAL_MS } from '../hooks/useRefreshedLoad';
import { tokenStore } from '../services/tokenStore';
import { makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import {
  makeActivityRecord,
  makeAdvisingReport,
  makeMeetingRecord,
  recordsRoutes,
  reportActivityRoutes,
  reportRoutes,
} from '../test/advisingReportApi';
import { makeComment } from '../test/commentsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const REPORT = '/aluno/historico/7/relatorio';
const ACTIVITY = `${REPORT}/atividades/2`;
const API = '/api/orientacao/historico/7/atividades/2';

const STUDENT = { id: 7, full_name: 'Ana Souza', type: 'student' } as const;

function archivedActivity(overrides: Partial<FakeActivity> = {}): FakeActivity {
  return makeActivity(2, {
    title: 'Revisar capítulo de resultados',
    description: 'Reescrever a discussão dos resultados.',
    deadline: '2026-10-25',
    status: 'archived',
    student: { id: 7, full_name: 'Ana Souza' },
    submissions: [
      {
        id: 3,
        submitted_at: '2026-10-20T12:00:00Z',
        files: [
          {
            id: 11,
            file_name: 'capitulo.pdf',
            size_bytes: 2048,
            content_type: 'application/pdf',
          },
        ],
      },
    ],
    reviews: [
      {
        id: 4,
        decision: 'rejected',
        justification: 'Faltou a tabela 2.',
        decided_at: '2026-10-22T12:00:00Z',
        files: [
          {
            id: 21,
            file_name: 'correcoes.pdf',
            size_bytes: 1024,
            content_type: 'application/pdf',
          },
        ],
      },
    ],
    comments_count: 1,
    ...overrides,
  });
}

function setup({
  path = ACTIVITY,
  user = 'student' as 'student' | 'teacher',
  activity = archivedActivity(),
  entries,
}: {
  path?: string;
  user?: 'student' | 'teacher';
  activity?: FakeActivity;
  entries?: { pathname: string; state?: unknown }[];
} = {}) {
  const fetchMock = mockApi({
    ...reportRoutes([makeAdvisingReport(7)], user),
    ...recordsRoutes(7, [
      makeMeetingRecord(1),
      makeActivityRecord(2, { title: 'Revisar capítulo de resultados' }),
    ]),
    ...reportActivityRoutes(
      7,
      [activity],
      [
        makeComment(1, {
          text: 'Enviei a versão nova.',
          created_at: '2026-10-21T12:00:00Z',
          author: STUDENT,
        }),
      ],
    ),
  });
  const events = userEvent.setup();
  renderApp(path, entries ? { entries } : {});
  return { fetchMock, events };
}

const location = () => screen.getByTestId('location').textContent;

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Relatório da orientação: o acesso à atividade (RF61)', () => {
  it('o cartão da atividade não expande e leva à atividade por "Ver atividade"', async () => {
    const { events } = setup({ path: REPORT });

    const card = await screen.findByRole('article', {
      name: 'Revisar capítulo de resultados',
    });
    expect(
      within(card).queryByRole('button', { name: /Ver detalhes/ }),
    ).not.toBeInTheDocument();
    const link = within(card).getByRole('link', {
      name: 'Ver atividade Revisar capítulo de resultados',
    });
    expect(link).toHaveTextContent('Ver atividade →');

    await events.click(link);

    expect(location()).toBe(ACTIVITY);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Revisar capítulo de resultados',
      }),
    ).toBeVisible();
  });
});

describe('Atividade do relatório: só leitura (RF61)', () => {
  it('mostra o resumo, a descrição e a linha do tempo da atividade arquivada', async () => {
    setup();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Revisar capítulo de resultados',
      }),
    ).toBeVisible();
    const summary = screen.getByRole('region', { name: 'Resumo da atividade' });
    expect(
      within(summary).getByText('Arquivada ao encerrar a orientação'),
    ).toBeVisible();
    expect(within(summary).getByText('Ana Souza')).toBeVisible();
    expect(within(summary).getByText('Carlos Lima')).toBeVisible();
    expect(
      screen.getByText('Reescrever a discussão dos resultados.'),
    ).toBeVisible();
    const timeline = await screen.findByRole('list', {
      name: 'Eventos da atividade',
    });
    expect(within(timeline).getByText('Enviei a versão nova.')).toBeVisible();
    expect(within(timeline).getByText('Faltou a tabela 2.')).toBeVisible();
  });

  it('a atividade concluída mostra "Concluída"', async () => {
    setup({ activity: archivedActivity({ status: 'completed' }) });

    const summary = await screen.findByRole('region', {
      name: 'Resumo da atividade',
    });

    expect(within(summary).getByText('Concluída')).toBeVisible();
  });

  it.each(['student', 'teacher'] as const)(
    'o %s não vê nenhuma ação nem o campo de comentário',
    async (user) => {
      setup({
        user,
        path:
          user === 'teacher'
            ? ACTIVITY.replace('/aluno/', '/professor/')
            : ACTIVITY,
      });

      await screen.findByRole('list', { name: 'Eventos da atividade' });

      expect(
        screen.queryByRole('heading', { name: 'Ações' }),
      ).not.toBeInTheDocument();
      for (const name of [
        'Editar',
        'Excluir',
        'Entregar arquivos',
        'Enviar para revisão',
        'Aceitar atividade',
        'Recusar atividade',
        'Comentar',
      ]) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    },
  );

  it('baixa os arquivos da entrega e da recusa pelo relatório', async () => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:arquivo'),
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );
    const { fetchMock, events } = setup();

    await events.click(
      await screen.findByRole('button', { name: 'Baixar capitulo.pdf' }),
    );
    await events.click(
      screen.getByRole('button', { name: 'Baixar correcoes.pdf' }),
    );

    await waitFor(() =>
      expect(requestsTo(fetchMock, `GET ${API}/arquivos/11`)).toHaveLength(1),
    );
    await waitFor(() =>
      expect(
        requestsTo(fetchMock, `GET ${API}/revisoes/4/arquivos/21`),
      ).toHaveLength(1),
    );
  });

  it('não relê a atividade nem a linha do tempo sozinha', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { fetchMock } = setup();
    await screen.findByRole('list', { name: 'Eventos da atividade' });

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 2);
    });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(requestsTo(fetchMock, `GET ${API}`)).toHaveLength(1);
    expect(requestsTo(fetchMock, `GET ${API}/linha-do-tempo`)).toHaveLength(1);
  });

  it('mostra "Atividade não encontrada" para uma atividade fora do relatório', async () => {
    setup({ path: `${REPORT}/atividades/99` });

    expect(
      await screen.findByRole('heading', { name: 'Atividade não encontrada' }),
    ).toBeVisible();
  });

  it('funciona na largura do telefone, sem rolagem lateral', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Revisar capítulo de resultados',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Voltar para o relatório' }),
    ).toBeVisible();
  });
});

describe('Atividade do relatório: "Voltar para o relatório" (RNF30)', () => {
  it('volta à página e ao filtro de onde a pessoa veio', async () => {
    const from = `${REPORT}?tipo=atividades`;
    const { events } = setup({ path: from });

    await events.click(
      await screen.findByRole('link', {
        name: 'Ver atividade Revisar capítulo de resultados',
      }),
    );
    await events.click(
      await screen.findByRole('link', { name: 'Voltar para o relatório' }),
    );

    expect(location()).toBe(from);
  });

  it('sem origem, volta à primeira página do relatório', async () => {
    const { events } = setup();

    await events.click(
      await screen.findByRole('link', { name: 'Voltar para o relatório' }),
    );

    expect(location()).toBe(REPORT);
  });

  it('ignora uma origem que não é o relatório desta orientação', async () => {
    setup({
      entries: [
        {
          pathname: ACTIVITY,
          state: { from: '/aluno/historico/8/relatorio?pagina=2' },
        },
      ],
    });

    expect(
      await screen.findByRole('link', { name: 'Voltar para o relatório' }),
    ).toHaveAttribute('href', REPORT);
  });
});
