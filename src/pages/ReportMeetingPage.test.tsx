import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFRESH_INTERVAL_MS } from '../hooks/useRefreshedLoad';
import { tokenStore } from '../services/tokenStore';
import {
  makeActivityRecord,
  makeAdvisingReport,
  makeMeetingRecord,
  recordsRoutes,
  reportMeetingRoutes,
  reportRoutes,
} from '../test/advisingReportApi';
import { makeMeeting } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const REPORT = '/aluno/historico/7/relatorio';
const MEETING = `${REPORT}/reunioes/1`;
const API = 'GET /api/orientacao/historico/7/reunioes/1';

function heldMeeting(overrides: Partial<FakeMeeting> = {}): FakeMeeting {
  return makeMeeting(1, {
    scheduled_at: '2026-10-20T10:00:00-03:00',
    ends_at: '2026-10-20T11:30:00-03:00',
    description: 'Discussão dos ajustes finais do trabalho.',
    status: 'accepted',
    situation: 'held',
    author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
    counterpart: { id: 9, full_name: 'Carlos Lima' },
    can_edit: false,
    can_cancel: false,
    notes: 'Revisar as referências até a próxima semana.',
    ...overrides,
  });
}

function setup({
  path = MEETING,
  user = 'student' as 'student' | 'teacher',
  meeting = heldMeeting(),
}: {
  path?: string;
  user?: 'student' | 'teacher';
  meeting?: FakeMeeting;
} = {}) {
  const fetchMock = mockApi({
    ...reportRoutes([makeAdvisingReport(7)], user),
    ...recordsRoutes(7, [
      makeMeetingRecord(1, { date: '2026-10-20' }),
      makeActivityRecord(2, { title: 'Revisar capítulo de resultados' }),
    ]),
    ...reportMeetingRoutes(7, [meeting]),
  });
  const events = userEvent.setup();
  renderApp(path);
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
});

describe('Relatório da orientação: o acesso à reunião (RF61)', () => {
  it('nenhum cartão expande, e o da reunião leva a ela por "Ver reunião"', async () => {
    const { events } = setup({ path: REPORT });

    const card = await screen.findByRole('article', {
      name: 'Reunião de 20/10/2026',
    });
    expect(screen.queryByRole('button', { name: /detalhes/ })).toBeNull();
    const link = within(card).getByRole('link', {
      name: 'Ver reunião Reunião de 20/10/2026',
    });
    expect(link).toHaveTextContent('Ver reunião →');

    await events.click(link);

    expect(location()).toBe(MEETING);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Reunião de 20/10/2026',
      }),
    ).toBeVisible();
  });
});

describe('Reunião do relatório: só leitura (RF61)', () => {
  it('mostra o mesmo conteúdo do modal da reunião', async () => {
    setup();

    expect(
      await screen.findByText('20 de outubro de 2026, das 10:00 às 11:30'),
    ).toBeVisible();
    expect(screen.getByText('Com: Carlos Lima')).toBeVisible();
    expect(
      screen.getByText('Discussão dos ajustes finais do trabalho.'),
    ).toBeVisible();
    expect(screen.getByText('Realizada')).toBeVisible();
    const notes = screen.getByRole('region', { name: 'Apontamentos' });
    expect(
      within(notes).getByText('Revisar as referências até a próxima semana.'),
    ).toBeVisible();
    expect(screen.getByText('Solicitada por Carlos Lima')).toBeVisible();
  });

  it('diz "Você" quando quem lê solicitou a reunião', async () => {
    setup({
      meeting: heldMeeting({
        author: { id: 7, full_name: 'Ana Souza', type: 'student' },
      }),
    });

    expect(await screen.findByText('Solicitada por Você')).toBeVisible();
  });

  it('sem apontamentos, diz que não há', async () => {
    setup({ meeting: heldMeeting({ notes: '' }) });

    const notes = await screen.findByRole('region', { name: 'Apontamentos' });

    expect(
      within(notes).getByText('Sem apontamentos registrados.'),
    ).toBeVisible();
  });

  it.each(['student', 'teacher'] as const)(
    'o %s não vê nenhuma ação',
    async (user) => {
      setup({
        user,
        path:
          user === 'teacher'
            ? MEETING.replace('/aluno/', '/professor/')
            : MEETING,
      });

      await screen.findByRole('region', { name: 'Apontamentos' });

      expect(
        screen
          .getAllByRole('button')
          .map((button) => button.textContent)
          .filter((name) =>
            /Aceitar|Recusar|Editar|Cancelar|Marcar|apontamentos|Fechar/.test(
              name ?? '',
            ),
          ),
      ).toEqual([]);
    },
  );

  it('não relê a reunião sozinha', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { fetchMock } = setup();
    await screen.findByRole('region', { name: 'Apontamentos' });

    await act(async () => {
      vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 2);
    });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(requestsTo(fetchMock, API)).toHaveLength(1);
  });

  it('mostra "Reunião não encontrada" para uma reunião fora do relatório', async () => {
    setup({ path: `${REPORT}/reunioes/99` });

    expect(
      await screen.findByRole('heading', { name: 'Reunião não encontrada' }),
    ).toBeVisible();
  });

  it('funciona na largura do telefone', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Reunião de 20/10/2026',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Voltar para o relatório' }),
    ).toBeVisible();
  });
});

describe('Reunião do relatório: "Voltar para o relatório" (RNF30)', () => {
  it('volta à página e ao filtro de onde a pessoa veio', async () => {
    const from = `${REPORT}?tipo=reunioes`;
    const { events } = setup({ path: from });

    await events.click(
      await screen.findByRole('link', {
        name: 'Ver reunião Reunião de 20/10/2026',
      }),
    );
    await events.click(
      await screen.findByRole('link', { name: 'Voltar para o relatório' }),
    );

    expect(location()).toBe(from);
  });

  it('sem origem, volta à primeira página do relatório', async () => {
    setup();

    expect(
      await screen.findByRole('link', { name: 'Voltar para o relatório' }),
    ).toHaveAttribute('href', REPORT);
  });
});
