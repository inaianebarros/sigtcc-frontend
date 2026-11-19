import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFRESH_INTERVAL_MS } from '../hooks/useRefreshedLoad';
import {
  MEETING_CHANGED_MESSAGE,
  MEETING_GONE_MESSAGE,
} from '../meetings/meetingFreshness';
import { tokenStore } from '../services/tokenStore';
import {
  CALENDAR_NOW,
  setupCalendarTest,
  teardownCalendarTest,
} from '../test/calendarClock';
import { makeMeeting, meetingsServer } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const PERIOD = 'GET /api/reunioes/calendario';

// A reunião que o professor solicitou ao aluno: o aluno pode aceitar, recusar ou cancelar.
const FROM_TEACHER = makeMeeting(1, {
  description: 'Pauta do capítulo 2',
  author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
  can_answer: true,
  can_edit: false,
  can_cancel: false,
});

// A reunião que o próprio aluno solicitou: ele pode editá-la e cancelá-la.
const OWN = makeMeeting(2, {
  scheduled_at: '2026-11-12T09:00:00-03:00',
  description: 'Revisão da introdução',
});

function setup(meetings: FakeMeeting[]) {
  const server = meetingsServer(meetings, { user: 'student' });
  const fetchMock = mockApi(server.routes);
  // Clique e digitação sem esperar o relógio falso: ele só anda quando o teste manda.
  const events = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderApp('/aluno/reunioes');
  return { fetchMock, events, server };
}

/** O que a outra parte fez no servidor, entre duas leituras do calendário. */
function changeOnServer(
  server: ReturnType<typeof setup>['server'],
  id: number,
  change: Partial<FakeMeeting>,
) {
  const found = server.meetings().find((item) => item.id === id);
  if (!found) throw new Error(`reunião ${id} ausente`);
  Object.assign(found, change);
}

/** Um ciclo de releitura: 30 s com a aba visível. */
async function nextCycle() {
  // O ciclo é registrado num efeito: o `act` o descarrega antes de o relógio andar.
  await act(async () => {});
  await act(async () => {
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
  });
}

function cardsOf(description: string) {
  return screen.queryAllByRole('button', {
    name: new RegExp(`: ${description}$`),
  });
}

async function openMeeting(
  events: ReturnType<typeof userEvent.setup>,
  description: string,
) {
  await events.click(
    await screen.findByRole('button', { name: new RegExp(description) }),
  );
  return screen.findByRole('dialog', { name: 'Reunião' });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  setViewportWidth(DESKTOP_WIDTH);
  setupCalendarTest();
  // O ciclo de 30 s precisa dos temporizadores falsos, e não só do relógio que o calendário
  // congela; o relógio continua em novembro de 2026.
  vi.useRealTimers();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(CALENDAR_NOW));
});

afterEach(() => {
  teardownCalendarTest();
});

describe('Reuniões: a releitura a cada 30 s', () => {
  it('mostra em até 30 s o aceite e a nova solicitação feitos pela outra parte, sem barra de carregamento', async () => {
    const { server, fetchMock } = setup([OWN]);
    await screen.findByRole('button', { name: /Pendente: Revisão/ });
    const reads = requestsTo(fetchMock, PERIOD).length;

    changeOnServer(server, OWN.id, {
      status: 'accepted',
      situation: 'accepted',
    });
    server.meetings().push(
      makeMeeting(3, {
        scheduled_at: '2026-11-25T10:00:00-03:00',
        description: 'Nova pauta do professor',
        author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
      }),
    );
    await act(async () => {
      vi.advanceTimersByTime(REFRESH_INTERVAL_MS - 1000);
    });
    expect(requestsTo(fetchMock, PERIOD)).toHaveLength(reads);

    await nextCycle();

    expect(
      await screen.findByRole('button', { name: /Aceita: Revisão/ }),
    ).toBeVisible();
    expect(cardsOf('Nova pauta do professor')).toHaveLength(1);
    expect(requestsTo(fetchMock, PERIOD)).toHaveLength(reads + 1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it.each([
    ['recusada', { status: 'rejected', situation: 'rejected' }, 'Recusada'],
    ['cancelada', { status: 'cancelled', situation: 'cancelled' }, 'Cancelada'],
    ['realizada', { situation: 'held', marked_held: true }, 'Realizada'],
  ] as const)(
    'mostra a reunião %s pela outra parte no ciclo seguinte',
    async (_label, change, situation) => {
      const { server } = setup([OWN]);
      await screen.findByRole('button', { name: /Pendente: Revisão/ });

      changeOnServer(server, OWN.id, change);
      await nextCycle();

      expect(
        await screen.findByRole('button', {
          name: new RegExp(`${situation}: Revisão`),
        }),
      ).toBeVisible();
    },
  );

  it('mantém a visão, o período e os filtros depois da releitura', async () => {
    const { server, fetchMock, events } = setup([OWN]);
    await screen.findByRole('button', { name: /Revisão/ });
    await events.click(screen.getByRole('button', { name: 'Semana' }));
    await screen.findByRole('heading', {
      level: 2,
      name: '8 – 14 de novembro de 2026',
    });
    await events.click(screen.getByRole('checkbox', { name: 'Recusada' }));
    await waitFor(() =>
      expect(
        new URL(
          String(requestsTo(fetchMock, PERIOD).at(-1)?.[0]),
          'http://localhost',
        ).searchParams.getAll('situation'),
      ).not.toContain('rejected'),
    );
    await screen.findByRole('button', { name: /Revisão/ });
    const reads = requestsTo(fetchMock, PERIOD).length;

    changeOnServer(server, OWN.id, { description: 'Revisão da metodologia' });
    await nextCycle();

    expect(
      await screen.findByRole('button', { name: /Revisão da metodologia/ }),
    ).toBeVisible();
    const calls = requestsTo(fetchMock, PERIOD);
    expect(calls).toHaveLength(reads + 1);
    const params = new URL(String(calls.at(-1)?.[0]), 'http://localhost')
      .searchParams;
    expect(params.get('date_from')).toBe('2026-11-08');
    expect(params.get('date_to')).toBe('2026-11-14');
    expect(params.getAll('situation')).not.toContain('rejected');
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '8 – 14 de novembro de 2026',
      }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Recusada' }),
    ).not.toBeChecked();
  });
});

describe('Reuniões: os diálogos abertos durante a releitura', () => {
  it('o modal da reunião continua aberto e mostra o dado novo; se a reunião sai do calendário, avisa e tira as ações', async () => {
    const { server, events } = setup([FROM_TEACHER]);
    const dialog = await openMeeting(events, 'Pauta do capítulo 2');
    expect(
      within(dialog).getByRole('button', { name: /Aceitar/ }),
    ).toBeVisible();

    changeOnServer(server, FROM_TEACHER.id, {
      description: 'Pauta do capítulo 3',
    });
    await nextCycle();

    await within(dialog).findByText('Pauta do capítulo 3');
    expect(screen.getByRole('dialog', { name: 'Reunião' })).toBe(dialog);
    expect(within(dialog).queryByText(MEETING_GONE_MESSAGE)).toBeNull();

    // O professor a remarcou para dezembro: ela sai do mês exibido.
    changeOnServer(server, FROM_TEACHER.id, {
      scheduled_at: '2026-12-20T14:30:00-03:00',
      ends_at: '2026-12-20T15:30:00-03:00',
    });
    await nextCycle();

    expect(await within(dialog).findByText(MEETING_GONE_MESSAGE)).toBeVisible();
    expect(within(dialog).getByText('Pauta do capítulo 3')).toBeVisible();
    expect(
      within(dialog).queryByRole('button', { name: /Aceitar|Recusar/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Reunião' })).toBe(dialog);
  });

  it('o diálogo de recusa mantém a justificativa digitada e o foco, e avisa quando a reunião muda ou some', async () => {
    const { server, events } = setup([FROM_TEACHER]);
    await openMeeting(events, 'Pauta do capítulo 2');
    await events.click(screen.getByRole('button', { name: /Recusar/ }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Recusar reunião',
    });
    const field = within(dialog).getByLabelText(/Justificativa/);
    await events.type(field, 'Estarei em banca');

    await nextCycle();
    expect(within(dialog).queryByText(MEETING_CHANGED_MESSAGE)).toBeNull();

    changeOnServer(server, FROM_TEACHER.id, {
      scheduled_at: '2026-11-21T08:00:00-03:00',
      ends_at: '2026-11-21T09:00:00-03:00',
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(MEETING_CHANGED_MESSAGE),
    ).toBeVisible();
    expect(field).toHaveValue('Estarei em banca');
    expect(field).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Recusar reunião' })).toBe(
      dialog,
    );

    // O professor a remarcou de novo, agora para dezembro: ela sai do mês exibido.
    changeOnServer(server, FROM_TEACHER.id, {
      scheduled_at: '2026-12-21T08:00:00-03:00',
      ends_at: '2026-12-21T09:00:00-03:00',
    });
    await nextCycle();

    expect(await within(dialog).findByText(MEETING_GONE_MESSAGE)).toBeVisible();
    expect(field).toHaveValue('Estarei em banca');
  });

  it('a edição mantém o que foi digitado e avisa quando a outra parte muda a reunião', async () => {
    const { server, events } = setup([OWN]);
    await openMeeting(events, 'Revisão da introdução');
    await events.click(screen.getByRole('button', { name: /Editar/ }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar reunião',
    });
    const description = within(dialog).getByLabelText(/Descrição/);
    await events.clear(description);
    await events.type(description, 'Revisão do resumo');

    changeOnServer(server, OWN.id, {
      status: 'accepted',
      situation: 'accepted',
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(MEETING_CHANGED_MESSAGE),
    ).toBeVisible();
    expect(description).toHaveValue('Revisão do resumo');
    expect(description).toHaveFocus();
    expect(
      within(dialog).getByText(/Você tem alterações não salvas/),
    ).toBeVisible();
  });

  it('a solicitação nova continua aberta, com o rascunho, sem aviso', async () => {
    const { server, events } = setup([OWN]);
    await screen.findByRole('button', { name: /Revisão/ });
    await events.click(
      screen.getByRole('button', { name: 'Solicitar reunião' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Solicitar reunião',
    });
    const description = within(dialog).getByLabelText(/Descrição/);
    await events.type(description, 'Pauta do cronograma');

    changeOnServer(server, OWN.id, {
      status: 'accepted',
      situation: 'accepted',
    });
    await nextCycle();

    await screen.findByRole('button', {
      name: /Aceita: Revisão/,
      hidden: true,
    });
    expect(screen.getByRole('dialog', { name: 'Solicitar reunião' })).toBe(
      dialog,
    );
    expect(description).toHaveValue('Pauta do cronograma');
    expect(description).toHaveFocus();
    expect(within(dialog).queryByText(MEETING_CHANGED_MESSAGE)).toBeNull();
    expect(within(dialog).queryByText(MEETING_GONE_MESSAGE)).toBeNull();
  });
});
