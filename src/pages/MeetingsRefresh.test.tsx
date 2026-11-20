import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFRESH_INTERVAL_MS } from '../hooks/useRefreshedLoad';
import {
  ADVISING_ENDED_MEETING_MESSAGE,
  ADVISING_ENDED_NOTES_MESSAGE,
  MEETING_GONE_DETAILS_MESSAGE,
  MEETING_GONE_FORM_MESSAGE,
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

// A reunião aceita que o professor solicitou: o aluno pode cancelá-la (RN10), mas não editá-la.
const ACCEPTED = makeMeeting(3, {
  scheduled_at: '2026-11-18T10:00:00-03:00',
  description: 'Pauta do cronograma',
  author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
  status: 'accepted',
  situation: 'accepted',
  can_edit: false,
  can_cancel: true,
});

// A reunião realizada, vista pelo professor orientador: ele grava os apontamentos (RN44).
const HELD = makeMeeting(4, {
  scheduled_at: '2026-11-05T10:00:00-03:00',
  description: 'Conversa sobre o sumário',
  author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
  counterpart: { id: 7, full_name: 'Ana Souza' },
  status: 'accepted',
  situation: 'held',
  marked_held: true,
  can_edit: false,
  can_cancel: false,
  can_edit_notes: true,
});

function setup(
  meetings: FakeMeeting[],
  user: 'student' | 'teacher' = 'student',
) {
  const server = meetingsServer(meetings, { user });
  const fetchMock = mockApi(server.routes);
  // Clique e digitação sem esperar o relógio falso: ele só anda quando o teste manda.
  const events = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderApp(user === 'student' ? '/aluno/reunioes' : '/professor/reunioes');
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

/** Abre, pelo modal da reunião, o diálogo de recusar ou de cancelar e digita o texto. */
async function openReasonDialog(
  events: ReturnType<typeof userEvent.setup>,
  description: string,
  kind: 'reject' | 'cancel',
  text: string,
) {
  await openMeeting(events, description);
  await events.click(
    screen.getByRole('button', {
      name: kind === 'reject' ? /^Recusar a reunião/ : /^Cancelar a reunião/,
    }),
  );
  const dialog = await screen.findByRole('dialog', {
    name: kind === 'reject' ? 'Recusar reunião' : 'Cancelar reunião',
  });
  const field = within(dialog).getByLabelText(
    kind === 'reject' ? /Justificativa/ : /Motivo/,
  );
  await events.type(field, text);
  const confirm = within(dialog).getByRole('button', {
    name: kind === 'reject' ? 'Recusar' : 'Cancelar reunião',
  });
  expect(confirm).toBeEnabled();
  return { dialog, field, confirm };
}

async function openEditDialog(
  events: ReturnType<typeof userEvent.setup>,
  description: string,
) {
  await openMeeting(events, description);
  await events.click(screen.getByRole('button', { name: /^Editar a reunião/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Editar reunião' });
  const field = within(dialog).getByLabelText(/Descrição/);
  await events.clear(field);
  await events.type(field, 'Revisão do resumo');
  return { dialog, field };
}

describe('Reuniões: o modal da reunião durante a releitura', () => {
  it('continua aberto e mostra o dado novo; se a reunião sai do calendário, avisa e fica só com "Fechar"', async () => {
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
    expect(within(dialog).queryByText(MEETING_GONE_DETAILS_MESSAGE)).toBeNull();

    // O professor a remarcou para dezembro: ela sai do mês exibido.
    changeOnServer(server, FROM_TEACHER.id, {
      scheduled_at: '2026-12-20T14:30:00-03:00',
      ends_at: '2026-12-20T15:30:00-03:00',
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(MEETING_GONE_DETAILS_MESSAGE),
    ).toBeVisible();
    expect(within(dialog).getByText('Pauta do capítulo 3')).toBeVisible();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Fechar']);
    expect(screen.getByRole('dialog', { name: 'Reunião' })).toBe(dialog);
  });
});

describe('Reuniões: a reunião mudou e a ação ainda cabe (a)', () => {
  it('na recusa, diz a nova data e a situação, mantém o texto e o foco, anuncia uma vez e, se a reunião sai do calendário, desabilita "Recusar" (c)', async () => {
    const { server, events } = setup([FROM_TEACHER]);
    const { dialog, field, confirm } = await openReasonDialog(
      events,
      'Pauta do capítulo 2',
      'reject',
      'Estarei em banca',
    );

    await nextCycle();
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(within(dialog).getAllByRole('status')[0]).toBeEmptyDOMElement();

    changeOnServer(server, FROM_TEACHER.id, {
      scheduled_at: '2026-11-21T08:00:00-03:00',
      ends_at: '2026-11-21T09:00:00-03:00',
    });
    await nextCycle();

    const notice = await within(dialog).findByText(
      'Esta reunião mudou. Agora é em sábado, 21 de novembro, das 8h às 9h, e está pendente.',
    );
    expect(notice).toBeVisible();
    expect(field).toHaveValue('Estarei em banca');
    expect(field).toHaveFocus();
    expect(confirm).toBeEnabled();
    expect(screen.getByRole('dialog', { name: 'Recusar reunião' })).toBe(
      dialog,
    );

    // Sem mudança nova, a releitura não toca no aviso: nada a anunciar de novo.
    await nextCycle();
    expect(
      within(dialog).getByText(/^Esta reunião mudou\. Agora é em sábado/),
    ).toBe(notice);

    // O professor a remarcou de novo, agora para dezembro: ela sai do mês exibido.
    changeOnServer(server, FROM_TEACHER.id, {
      scheduled_at: '2026-12-21T08:00:00-03:00',
      ends_at: '2026-12-21T09:00:00-03:00',
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(MEETING_GONE_FORM_MESSAGE),
    ).toBeVisible();
    expect(field).toHaveValue('Estarei em banca');
    expect(field).toHaveFocus();
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent('Recusar');
  });

  it('no cancelamento, diz a nova situação de uma pendente aceita e mantém "Cancelar reunião" habilitado', async () => {
    const { server, events } = setup([OWN]);
    const { dialog, field, confirm } = await openReasonDialog(
      events,
      'Revisão da introdução',
      'cancel',
      'Viagem a congresso',
    );

    changeOnServer(server, OWN.id, {
      status: 'accepted',
      situation: 'accepted',
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'Esta reunião mudou. Agora é em quinta-feira, 12 de novembro, das 9h às 10h, e está aceita.',
      ),
    ).toBeVisible();
    expect(field).toHaveValue('Viagem a congresso');
    expect(confirm).toBeEnabled();
  });

  it('no cancelamento, mostra a descrição nova quando só ela mudou', async () => {
    const { server, events } = setup([ACCEPTED]);
    const { dialog, field, confirm } = await openReasonDialog(
      events,
      'Pauta do cronograma',
      'cancel',
      'Viagem a congresso',
    );

    changeOnServer(server, ACCEPTED.id, {
      description: 'Pauta do cronograma revisado',
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'A descrição desta reunião mudou: "Pauta do cronograma revisado".',
      ),
    ).toBeVisible();
    expect(field).toHaveValue('Viagem a congresso');
    expect(confirm).toBeEnabled();
  });

  it('na edição, avisa que a pendente foi aceita e mantém os campos, o foco e "Salvar" habilitado', async () => {
    const { server, events } = setup([OWN]);
    const { dialog, field } = await openEditDialog(
      events,
      'Revisão da introdução',
    );

    changeOnServer(server, OWN.id, {
      status: 'accepted',
      situation: 'accepted',
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'Esta reunião foi aceita. Se você mudar a data ou o horário, ela volta a pendente e precisa ser aceita de novo.',
      ),
    ).toBeVisible();
    expect(field).toHaveValue('Revisão do resumo');
    expect(field).toHaveFocus();
    expect(within(dialog).getByLabelText(/Data/)).toHaveValue('2026-11-12');
    expect(
      within(dialog).getByText(/Você tem alterações não salvas/),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeEnabled();
  });
});

describe('Reuniões: a ação não cabe mais (b)', () => {
  it.each([
    [
      'recusada',
      OWN,
      {
        status: 'rejected',
        situation: 'rejected',
        rejection_reason: 'Estarei em banca',
        can_edit: false,
        can_cancel: false,
      },
      'Esta reunião foi recusada e não pode mais ser cancelada.',
    ],
    [
      'cancelada',
      ACCEPTED,
      {
        status: 'cancelled',
        situation: 'cancelled',
        cancellation_reason: 'Imprevisto',
        can_cancel: false,
      },
      'Esta reunião já foi cancelada.',
    ],
    [
      'remarcada e de volta a pendente',
      ACCEPTED,
      {
        status: 'pending',
        situation: 'pending',
        scheduled_at: '2026-11-26T14:00:00-03:00',
        ends_at: '2026-11-26T15:00:00-03:00',
        can_answer: true,
        can_cancel: false,
      },
      'Esta reunião foi remarcada para quinta-feira, 26 de novembro, das 14h às 15h, e voltou a pendente. Agora você não pode cancelá-la, mas pode recusá-la pelo botão Recusar da reunião.',
    ],
    [
      'realizada',
      ACCEPTED,
      { situation: 'held', marked_held: true, can_cancel: false },
      'Esta reunião já foi realizada e não pode mais ser cancelada.',
    ],
    [
      'expirada',
      OWN,
      { situation: 'expired', can_edit: false, can_cancel: false },
      'O horário desta reunião passou sem resposta, e ela não pode mais ser cancelada.',
    ],
    [
      'cancelada pelo encerramento da orientação',
      ACCEPTED,
      {
        status: 'cancelled',
        situation: 'cancelled',
        cancellation_reason: 'Orientação encerrada.',
        cancelled_by_system: true,
        can_cancel: false,
      },
      ADVISING_ENDED_MEETING_MESSAGE,
    ],
  ] as const)(
    'no cancelamento da reunião %s, explica, mantém o texto e desabilita "Cancelar reunião"',
    async (_label, meeting, change, message) => {
      const { server, events } = setup([meeting]);
      const { dialog, field, confirm } = await openReasonDialog(
        events,
        meeting.description,
        'cancel',
        'Viagem a congresso',
      );

      changeOnServer(server, meeting.id, change);
      await nextCycle();

      expect(await within(dialog).findByText(message)).toBeVisible();
      expect(field).toHaveValue('Viagem a congresso');
      expect(field).toHaveFocus();
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveTextContent('Cancelar reunião');
      expect(screen.getByRole('dialog', { name: 'Cancelar reunião' })).toBe(
        dialog,
      );
    },
  );

  it.each([
    [
      'cancelada',
      {
        status: 'cancelled',
        situation: 'cancelled',
        cancellation_reason: 'Imprevisto',
        can_answer: false,
      },
      'Esta reunião foi cancelada e não pode mais ser recusada.',
    ],
    [
      'expirada',
      { situation: 'expired', can_answer: false },
      'O horário desta reunião passou sem resposta, e ela não pode mais ser recusada.',
    ],
  ] as const)(
    'na recusa da reunião %s, explica, mantém o texto e desabilita "Recusar"',
    async (_label, change, message) => {
      const { server, events } = setup([FROM_TEACHER]);
      const { dialog, field, confirm } = await openReasonDialog(
        events,
        'Pauta do capítulo 2',
        'reject',
        'Estarei em banca',
      );

      changeOnServer(server, FROM_TEACHER.id, change);
      await nextCycle();

      expect(await within(dialog).findByText(message)).toBeVisible();
      expect(field).toHaveValue('Estarei em banca');
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveTextContent('Recusar');
    },
  );

  it('na edição da reunião recusada, explica, mantém os campos e desabilita "Salvar"', async () => {
    const { server, events } = setup([OWN]);
    const { dialog, field } = await openEditDialog(
      events,
      'Revisão da introdução',
    );

    changeOnServer(server, OWN.id, {
      status: 'rejected',
      situation: 'rejected',
      rejection_reason: 'Estarei em banca',
      can_edit: false,
      can_cancel: false,
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'Esta reunião foi recusada e não pode mais ser editada.',
      ),
    ).toBeVisible();
    expect(field).toHaveValue('Revisão do resumo');
    expect(field).toHaveFocus();
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeDisabled();
  });

  it('nos apontamentos, avisa que a orientação foi encerrada, mantém o texto e desabilita "Salvar"', async () => {
    const { server, events } = setup([HELD], 'teacher');
    await openMeeting(events, 'Conversa sobre o sumário');
    await events.click(
      screen.getByRole('button', { name: /^Adicionar apontamentos/ }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Apontamentos da reunião',
    });
    const field = within(dialog).getByLabelText(/Apontamentos/);
    await events.type(field, 'Revisar o sumário');
    const save = within(dialog).getByRole('button', { name: 'Salvar' });
    expect(save).toBeEnabled();

    server.endAdvising();
    changeOnServer(server, HELD.id, { can_edit_notes: false });
    await nextCycle();

    expect(
      await within(dialog).findByText(ADVISING_ENDED_NOTES_MESSAGE),
    ).toBeVisible();
    expect(field).toHaveValue('Revisar o sumário');
    expect(field).toHaveFocus();
    expect(save).toBeDisabled();
  });
});

const PENDING_CHANGES = /Você tem alterações não salvas/;
const RETURNS_TO_PENDING = /voltará a ficar pendente/;
const ACCEPTED_NOW =
  'Esta reunião foi aceita. Se você mudar a data ou o horário, ela volta a pendente e precisa ser aceita de novo.';

// A reunião aceita que o próprio aluno solicitou: ele pode editá-la, e mudar o horário a devolve a
// pendente (RN39).
const OWN_ACCEPTED = makeMeeting(5, {
  scheduled_at: '2026-11-19T10:00:00-03:00',
  description: 'Pauta da metodologia',
  status: 'accepted',
  situation: 'accepted',
});

async function expectDiscardOnClose(
  events: ReturnType<typeof userEvent.setup>,
) {
  await events.keyboard('{Escape}');
  expect(
    await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
  ).toBeVisible();
}

describe('Reuniões: a ação bloqueada não pede para gravar', () => {
  it('no cancelamento bloqueado, esconde o aviso de alterações não salvas e ainda pergunta antes de descartar', async () => {
    const { server, events } = setup([OWN]);
    const { dialog, confirm } = await openReasonDialog(
      events,
      'Revisão da introdução',
      'cancel',
      'Viagem a congresso',
    );
    expect(within(dialog).getByText(PENDING_CHANGES)).toBeVisible();

    changeOnServer(server, OWN.id, {
      status: 'rejected',
      situation: 'rejected',
      can_edit: false,
      can_cancel: false,
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'Esta reunião foi recusada e não pode mais ser cancelada.',
      ),
    ).toBeVisible();
    expect(confirm).toBeDisabled();
    expect(within(dialog).queryByText(PENDING_CHANGES)).toBeNull();
    await expectDiscardOnClose(events);
  });

  it('nos apontamentos bloqueados, esconde o aviso de alterações não salvas e ainda pergunta antes de descartar', async () => {
    const { server, events } = setup([HELD], 'teacher');
    await openMeeting(events, 'Conversa sobre o sumário');
    await events.click(
      screen.getByRole('button', { name: /^Adicionar apontamentos/ }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Apontamentos da reunião',
    });
    await events.type(
      within(dialog).getByLabelText(/Apontamentos/),
      'Revisar o sumário',
    );
    expect(within(dialog).getByText(PENDING_CHANGES)).toBeVisible();

    server.endAdvising();
    changeOnServer(server, HELD.id, { can_edit_notes: false });
    await nextCycle();

    expect(
      await within(dialog).findByText(ADVISING_ENDED_NOTES_MESSAGE),
    ).toBeVisible();
    expect(within(dialog).queryByText(PENDING_CHANGES)).toBeNull();
    await expectDiscardOnClose(events);
  });
});

describe('Reuniões: o aviso da RN39 na edição durante a releitura', () => {
  async function openAcceptedEdit(events: ReturnType<typeof userEvent.setup>) {
    await openMeeting(events, 'Pauta da metodologia');
    await events.click(
      screen.getByRole('button', { name: /^Editar a reunião/ }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar reunião',
    });
    fireEvent.change(within(dialog).getByLabelText(/Hora de início/), {
      target: { value: '10:30' },
    });
    return dialog;
  }

  it('esconde o aviso da RN39 e o de alterações não salvas quando a reunião é cancelada, e ainda pergunta antes de descartar', async () => {
    const { server, events } = setup([OWN_ACCEPTED]);
    const dialog = await openAcceptedEdit(events);
    expect(within(dialog).getByText(RETURNS_TO_PENDING)).toBeVisible();
    expect(within(dialog).getByText(PENDING_CHANGES)).toBeVisible();

    changeOnServer(server, OWN_ACCEPTED.id, {
      status: 'cancelled',
      situation: 'cancelled',
      cancellation_reason: 'Imprevisto',
      can_edit: false,
      can_cancel: false,
    });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'Esta reunião foi cancelada e não pode mais ser editada.',
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeDisabled();
    expect(within(dialog).queryByText(RETURNS_TO_PENDING)).toBeNull();
    expect(within(dialog).queryByText(PENDING_CHANGES)).toBeNull();
    expect(within(dialog).getByLabelText(/Hora de início/)).toHaveValue(
      '10:30',
    );
    await expectDiscardOnClose(events);
  });

  it('usa a situação relida: a aceita que voltou a pendente não mostra o aviso da RN39', async () => {
    const { server, events } = setup([OWN_ACCEPTED]);
    const dialog = await openAcceptedEdit(events);
    expect(within(dialog).getByText(RETURNS_TO_PENDING)).toBeVisible();

    changeOnServer(server, OWN_ACCEPTED.id, {
      status: 'pending',
      situation: 'pending',
      scheduled_at: '2026-11-20T10:00:00-03:00',
      ends_at: '2026-11-20T11:00:00-03:00',
    });
    await nextCycle();

    await waitFor(() =>
      expect(within(dialog).queryByText(RETURNS_TO_PENDING)).toBeNull(),
    );
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeEnabled();
  });

  it('na pendente aceita depois de aberta, mostra só o aviso de que foi aceita, sem repetir o da RN39', async () => {
    const { server, events } = setup([OWN]);
    await openMeeting(events, 'Revisão da introdução');
    await events.click(
      screen.getByRole('button', { name: /^Editar a reunião/ }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar reunião',
    });
    fireEvent.change(within(dialog).getByLabelText(/Hora de início/), {
      target: { value: '09:30' },
    });

    changeOnServer(server, OWN.id, {
      status: 'accepted',
      situation: 'accepted',
    });
    await nextCycle();

    expect(await within(dialog).findByText(ACCEPTED_NOW)).toBeVisible();
    expect(within(dialog).queryByText(RETURNS_TO_PENDING)).toBeNull();
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeEnabled();
  });
});

describe('Reuniões: a solicitação nova durante a releitura', () => {
  it('continua aberta, com o rascunho, sem aviso', async () => {
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
    expect(within(dialog).queryByText(/Esta reunião/)).toBeNull();
  });
});
