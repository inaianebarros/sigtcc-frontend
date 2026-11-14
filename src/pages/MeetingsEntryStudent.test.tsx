import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { setupCalendarTest, teardownCalendarTest } from '../test/calendarClock';
import { makeMeeting, meetingsServer } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const PERIOD = 'GET /api/reunioes/calendario';
const ADVISEES = 'GET /api/orientacao/orientandos/calendario';
const PATH = '/professor/reunioes';

const ADVISEE_LIST = [
  { id: 101, full_name: 'Ana Ativa', ended: false },
  { id: 102, full_name: 'Bruno Encerrado', ended: true },
  { id: 103, full_name: 'José Álvaro', ended: false },
];

function meetingWith(id: number, student: { id: number; full_name: string }) {
  return makeMeeting(id, {
    scheduled_at: `2026-11-${10 + id}T09:00:00-03:00`,
    counterpart: student,
    student_id: student.id,
    description: `Pauta de ${student.full_name}`,
  });
}

const MEETINGS = ADVISEE_LIST.map((advisee, index) =>
  meetingWith(index + 1, advisee),
);

function setup(
  path: string,
  {
    user = 'teacher' as 'student' | 'teacher',
    meetings = MEETINGS as FakeMeeting[],
    advisees = ADVISEE_LIST,
    routes = {},
  }: {
    user?: 'student' | 'teacher';
    meetings?: FakeMeeting[];
    advisees?: typeof ADVISEE_LIST;
    routes?: Record<string, unknown>;
  } = {},
) {
  const server = meetingsServer(meetings, { user, calendarAdvisees: advisees });
  const fetchMock = mockApi({
    ...server.routes,
    ...routes,
  } as typeof server.routes);
  const events = userEvent.setup();
  renderApp(path);
  return { fetchMock, events };
}

const queryCard = (text: string | RegExp) =>
  screen.queryByRole('button', { name: text });

function hiddenOf(call: unknown[] | undefined): number[] {
  const url = new URL(String(call?.[0]), 'http://localhost');
  return url.searchParams.getAll('hidden_student_ids').map(Number);
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  setViewportWidth(DESKTOP_WIDTH);
  setupCalendarTest();
});

afterEach(() => {
  teardownCalendarTest();
});

describe('Calendário aberto pelo "Ver reuniões" (RN46)', () => {
  it('?aluno= abre só com aquele orientando ligado e todas as situações ligadas', async () => {
    const { fetchMock } = setup(`${PATH}?aluno=101`);

    expect(
      await screen.findByRole('button', { name: /Pauta de Ana Ativa/ }),
    ).toBeVisible();
    expect(queryCard(/Pauta de Bruno Encerrado/)).not.toBeInTheDocument();
    expect(queryCard(/Pauta de José Álvaro/)).not.toBeInTheDocument();
    const advisees = screen.getByRole('group', { name: 'Orientandos' });
    await within(advisees).findByRole('checkbox', { name: 'Ana Ativa' });
    expect(
      within(advisees).getByRole('checkbox', { name: 'Ana Ativa' }),
    ).toBeChecked();
    expect(
      within(advisees).getByRole('checkbox', { name: /Bruno Encerrado/ }),
    ).not.toBeChecked();
    expect(
      within(advisees).getByRole('checkbox', { name: 'José Álvaro' }),
    ).not.toBeChecked();
    const situation = screen.getByRole('group', { name: 'Situação' });
    for (const box of within(situation).getAllByRole('checkbox')) {
      expect(box).toBeChecked();
    }
    // A primeira leitura de reuniões já sai filtrada: o calendário não pisca com todos.
    expect(hiddenOf(requestsTo(fetchMock, PERIOD)[0]).sort()).toEqual([
      102, 103,
    ]);
  });

  it('o parâmetro não é regravado, e o professor religa os demais orientandos no painel', async () => {
    const { fetchMock, events } = setup(`${PATH}?aluno=101`);
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    const advisees = screen.getByRole('group', { name: 'Orientandos' });

    await events.click(
      await within(advisees).findByRole('checkbox', {
        name: /Bruno Encerrado/,
      }),
    );

    expect(
      await screen.findByRole('button', { name: /Pauta de Bruno Encerrado/ }),
    ).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      `${PATH}?aluno=101`,
    );
    expect(hiddenOf(requestsTo(fetchMock, PERIOD).at(-1))).toEqual([103]);
  });

  it.each([
    ['um texto', 'abc'],
    ['zero', '0'],
    ['um negativo', '-3'],
    ['um id que não está no painel', '999'],
  ])(
    '%s em ?aluno= é ignorado e o calendário abre com todos ligados',
    async (_case, value) => {
      const { fetchMock } = setup(`${PATH}?aluno=${value}`);

      await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
      expect(
        await screen.findByRole('button', { name: /Pauta de Bruno Encerrado/ }),
      ).toBeVisible();
      expect(
        await screen.findByRole('button', { name: /Pauta de José Álvaro/ }),
      ).toBeVisible();
      for (const call of requestsTo(fetchMock, PERIOD)) {
        expect(hiddenOf(call)).toEqual([]);
      }
    },
  );

  it('abre na visão salva do professor, e o parâmetro não a muda', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:9', 'week');
    setup(`${PATH}?aluno=101`);

    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });

    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(window.localStorage.getItem('sigtcc:reunioes:visao:9')).toBe('week');
  });

  it('sem o parâmetro, o calendário abre como hoje, com todos ligados', async () => {
    const { fetchMock } = setup(PATH);

    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    expect(
      await screen.findByRole('button', { name: /Pauta de José Álvaro/ }),
    ).toBeVisible();
    expect(hiddenOf(requestsTo(fetchMock, PERIOD)[0])).toEqual([]);
  });

  it('o aluno logado ignora o parâmetro', async () => {
    const { fetchMock } = setup(
      `${PATH.replace('professor', 'aluno')}?aluno=101`,
      {
        user: 'student',
      },
    );

    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    expect(
      await screen.findByRole('button', { name: /Pauta de José Álvaro/ }),
    ).toBeVisible();
    expect(requestsTo(fetchMock, ADVISEES).length).toBe(0);
    for (const call of requestsTo(fetchMock, PERIOD)) {
      expect(hiddenOf(call)).toEqual([]);
    }
  });

  it('com mais orientandos do que cabem numa página, desliga todos os outros', async () => {
    const many = Array.from({ length: 130 }, (_, index) => ({
      id: 200 + index,
      full_name: `Orientando ${String(index).padStart(3, '0')}`,
      ended: false,
    }));
    const { fetchMock } = setup(`${PATH}?aluno=250`, {
      advisees: many,
      meetings: [meetingWith(1, many[50]!), meetingWith(2, many[0]!)],
    });

    expect(
      await screen.findByRole('button', { name: /Pauta de Orientando 050/ }),
    ).toBeVisible();
    expect(queryCard(/Pauta de Orientando 000/)).not.toBeInTheDocument();
    const hidden = hiddenOf(requestsTo(fetchMock, PERIOD)[0]);
    expect(hidden).toHaveLength(129);
    expect(hidden).not.toContain(250);
  });

  it('se a lista de orientandos falha, ignora o parâmetro e abre com todos ligados', async () => {
    const { fetchMock } = setup(`${PATH}?aluno=101`, {
      routes: { [ADVISEES]: { status: 500, body: { detail: 'Falha.' } } },
    });

    expect(
      await screen.findByRole('button', { name: /Pauta de José Álvaro/ }),
    ).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, PERIOD).length).toBeGreaterThan(0),
    );
    for (const call of requestsTo(fetchMock, PERIOD)) {
      expect(hiddenOf(call)).toEqual([]);
    }
  });
});
