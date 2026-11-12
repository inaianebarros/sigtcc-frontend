import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupCalendarTest, teardownCalendarTest } from '../test/calendarClock';
import { tokenStore } from '../services/tokenStore';
import { makeMeeting, meetingsServer } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const PATH = '/aluno/reunioes';
const LIST = 'GET /api/reunioes/calendario';

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup(
  meetings: FakeMeeting[],
  overrides: Overrides = {},
  user: 'student' | 'teacher' = 'student',
) {
  const server = meetingsServer(meetings, {
    user,
    overrides: overrides as never,
  });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(user === 'student' ? PATH : '/professor/reunioes');
  return { fetchMock, events, server };
}

const ANSWERABLE = makeMeeting(1, {
  description: 'Pauta para responder',
  scheduled_at: '2026-11-18T14:30:00-03:00',
  author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
  can_answer: true,
  can_edit: false,
  can_cancel: false,
});
const OWN = makeMeeting(2, {
  description: 'Pauta minha',
  scheduled_at: '2026-11-20T14:30:00-03:00',
  can_answer: false,
  can_edit: true,
  can_cancel: true,
});
const NONE = makeMeeting(3, {
  description: 'Pauta sem ações',
  scheduled_at: '2026-11-22T14:30:00-03:00',
  situation: 'expired',
  can_answer: false,
  can_edit: false,
  can_cancel: false,
});

/** O cartão da reunião no calendário: um botão cujo nome traz horário, outra parte, situação e descrição. */
function cardOf(text: string | RegExp) {
  return screen.getByRole('button', { name: text });
}

/** Abre o modal de uma reunião: o do cartão com o nome dado, ou o único do calendário. */
async function openMeeting(
  events: ReturnType<typeof userEvent.setup>,
  name?: string | RegExp,
) {
  if (name) {
    await events.click(await screen.findByRole('button', { name }));
  } else {
    const cards = await screen.findAllByRole('button', {
      name: /^\d\d:\d\d às \d\d:\d\d, /,
    });
    expect(cards).toHaveLength(1);
    await events.click(cards[0]!);
  }
  return screen.findByRole('dialog', { name: 'Reunião' });
}

function bodiesTo(
  fetchMock: ReturnType<typeof mockApi>,
  method: string,
  pathEnd: string,
) {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === method &&
        new URL(String(input), 'http://localhost').pathname.endsWith(pathEnd),
    )
    .map(
      ([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>,
    );
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  setupCalendarTest();
});

afterEach(() => {
  teardownCalendarTest();
});

describe('Reuniões: as ações aparecem só quando a flag do servidor é verdadeira', () => {
  it('mostra Aceitar e Recusar só com can_answer, e Editar e Cancelar só com as suas flags, no modal da reunião', async () => {
    const { events } = setup([ANSWERABLE, OWN, NONE]);

    const answerable = within(
      await openMeeting(events, /Pauta para responder/),
    );
    expect(answerable.getByRole('button', { name: /Aceitar/ })).toBeVisible();
    expect(answerable.getByRole('button', { name: /Recusar/ })).toBeVisible();
    expect(
      answerable.queryByRole('button', { name: /Editar/ }),
    ).not.toBeInTheDocument();
    expect(
      answerable.queryByRole('button', { name: /Cancelar/ }),
    ).not.toBeInTheDocument();
    await events.click(answerable.getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    const own = within(await openMeeting(events, /Pauta minha/));
    expect(own.getByRole('button', { name: /Editar/ })).toBeVisible();
    expect(own.getByRole('button', { name: /Cancelar/ })).toBeVisible();
    expect(
      own.queryByRole('button', { name: /Aceitar/ }),
    ).not.toBeInTheDocument();
    expect(
      own.queryByRole('button', { name: /Recusar/ }),
    ).not.toBeInTheDocument();
    await events.click(own.getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    const none = within(await openMeeting(events, /Pauta sem ações/));
    expect(
      none.queryByRole('button', { name: /Aceitar|Recusar|Editar|Cancelar/ }),
    ).not.toBeInTheDocument();
  });

  it('cada botão tem um nome acessível com a reunião', async () => {
    const { events } = setup([ANSWERABLE]);
    await openMeeting(events, /Pauta para responder/);

    expect(
      screen.getByRole('button', {
        name: 'Aceitar a reunião "Pauta para responder"',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Recusar a reunião "Pauta para responder"',
      }),
    ).toBeVisible();
  });

  it('no celular as mesmas ações aparecem no modal', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { events } = setup([ANSWERABLE]);

    const dialog = within(await openMeeting(events, /Pauta para responder/));

    expect(dialog.getByRole('button', { name: /Aceitar/ })).toBeVisible();
    expect(dialog.getByRole('button', { name: /Recusar/ })).toBeVisible();
  });
});

describe('Reuniões: aceitar', () => {
  it('aceita direto, sem diálogo, avisa e atualiza a lista', async () => {
    const { fetchMock, events } = setup([ANSWERABLE]);
    await openMeeting(events, /Pauta para responder/);

    await events.click(screen.getByRole('button', { name: /Aceitar/ }));

    expect(await screen.findByText('Reunião aceita.')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(bodiesTo(fetchMock, 'POST', '/responder')).toEqual([
      { action: 'accept' },
    ]);
    await waitFor(() =>
      expect(
        within(cardOf(/Pauta para responder/)).getByText('Aceita'),
      ).toBeVisible(),
    );
    expect(
      screen.queryByRole('button', { name: /Aceitar/ }),
    ).not.toBeInTheDocument();
  });

  it('desabilita as ações da linha enquanto o pedido está em curso e envia uma vez só', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup([ANSWERABLE], {
      'POST /api/reunioes/:id/responder': async () => {
        await gate;
        return { status: 200, body: makeMeeting(1, { situation: 'accepted' }) };
      },
    });
    await openMeeting(events, /Pauta para responder/);

    await events.click(screen.getByRole('button', { name: /Aceitar/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Aceitar/ })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: /Recusar/ })).toBeDisabled();
    release();
    await screen.findByText('Reunião aceita.');
    expect(bodiesTo(fetchMock, 'POST', '/responder')).toHaveLength(1);
  });

  it.each([404, 409])(
    'um %s mostra a mensagem do servidor e atualiza a lista',
    async (status) => {
      const { fetchMock, events } = setup([ANSWERABLE], {
        'POST /api/reunioes/:id/responder': {
          status,
          body: { detail: 'Esta reunião já foi respondida.' },
        },
      });
      await openMeeting(events, /Pauta para responder/);
      const reads = requestsTo(fetchMock, LIST).length;

      await events.click(screen.getByRole('button', { name: /Aceitar/ }));

      expect(
        await screen.findByText('Esta reunião já foi respondida.'),
      ).toBeVisible();
      await waitFor(() =>
        expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(reads),
      );
    },
  );

  it('uma falha do servidor mostra a mensagem e deixa tentar de novo', async () => {
    const { events } = setup([ANSWERABLE], {
      'POST /api/reunioes/:id/responder': { status: 500, body: {} },
    });
    await openMeeting(events, /Pauta para responder/);

    await events.click(screen.getByRole('button', { name: /Aceitar/ }));

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Aceitar/ })).toBeEnabled(),
    );
  });
});

const ACCEPTED_OF_OTHER = makeMeeting(4, {
  description: 'Pauta aceita do outro',
  situation: 'accepted',
  status: 'accepted',
  author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
  can_answer: false,
  can_edit: false,
  can_cancel: true,
});

async function openReason(
  events: ReturnType<typeof userEvent.setup>,
  button: string | RegExp,
  title: string,
  meeting?: string | RegExp,
) {
  await openMeeting(events, meeting);
  await events.click(await screen.findByRole('button', { name: button }));
  return screen.findByRole('dialog', { name: title });
}

describe('Reuniões: recusar com justificativa (RN11)', () => {
  const REJECT = 'POST /api/reunioes/:id/responder';

  it('abre o diálogo com a justificativa obrigatória e o botão desabilitado enquanto vazia', async () => {
    const { events } = setup([ANSWERABLE]);
    const dialog = await openReason(events, /Recusar/, 'Recusar reunião');

    expect(within(dialog).getByLabelText(/Justificativa/)).toHaveValue('');
    expect(within(dialog).getByText('0/500')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Recusar' }),
    ).toBeDisabled();
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();
  });

  it('recusa com a justificativa aparada, avisa e atualiza a lista', async () => {
    const { fetchMock, events } = setup([ANSWERABLE]);
    const dialog = await openReason(events, /Recusar/, 'Recusar reunião');

    await events.type(
      within(dialog).getByLabelText(/Justificativa/),
      '  Estarei em viagem.  ',
    );
    expect(within(dialog).getByText('18/500')).toBeVisible();
    await events.click(within(dialog).getByRole('button', { name: 'Recusar' }));

    expect(await screen.findByText('Reunião recusada.')).toBeVisible();
    expect(bodiesTo(fetchMock, 'POST', '/responder')).toEqual([
      { action: 'reject', reason: 'Estarei em viagem.' },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      within(cardOf(/Pauta para responder/)).getByText('Recusada'),
    ).toBeVisible();
    const details = within(await openMeeting(events, /Pauta para responder/));
    expect(
      details.getByText(/Motivo da recusa: Estarei em viagem\./),
    ).toBeVisible();
  });

  it('só espaços não vale, e passar de 500 caracteres mostra o erro e bloqueia o envio', async () => {
    const { events } = setup([ANSWERABLE]);
    const dialog = await openReason(events, /Recusar/, 'Recusar reunião');
    const field = within(dialog).getByLabelText(/Justificativa/);

    await events.type(field, '   ');
    expect(
      within(dialog).getByRole('button', { name: 'Recusar' }),
    ).toBeDisabled();

    await events.clear(field);
    await events.click(field);
    await events.paste('a'.repeat(501));
    expect(
      await within(dialog).findByText(
        'A justificativa deve ter no máximo 500 caracteres.',
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Recusar' }),
    ).toBeDisabled();

    await events.clear(field);
    await events.click(field);
    await events.paste('a'.repeat(500));
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Recusar' }),
      ).toBeEnabled(),
    );
  });

  it('com texto digitado mostra o aviso no topo e pede confirmação antes de fechar (RNF28)', async () => {
    const { fetchMock, events } = setup([ANSWERABLE]);
    const dialog = await openReason(events, /Recusar/, 'Recusar reunião');
    await events.type(
      within(dialog).getByLabelText(/Justificativa/),
      'Rascunho',
    );

    expect(
      await within(dialog).findByText(/Você tem alterações não salvas/),
    ).toHaveTextContent('Clique em Recusar para gravá-las.');
    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));
    await events.click(
      await screen.findByRole('button', { name: 'Continuar editando' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
      ).not.toBeInTheDocument(),
    );
    expect(within(dialog).getByLabelText(/Justificativa/)).toHaveValue(
      'Rascunho',
    );

    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));
    await events.click(
      await screen.findByRole('button', { name: 'Sair sem salvar' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Recusar reunião' }),
      ).not.toBeInTheDocument(),
    );
    expect(bodiesTo(fetchMock, 'POST', '/responder')).toEqual([]);
  });

  it.each([404, 409])(
    'um %s mostra a mensagem do servidor, fecha o diálogo e atualiza a lista',
    async (status) => {
      const { fetchMock, events } = setup([ANSWERABLE], {
        [REJECT]: {
          status,
          body: { detail: 'Esta reunião já foi respondida.' },
        },
      });
      const dialog = await openReason(events, /Recusar/, 'Recusar reunião');
      const reads = requestsTo(fetchMock, LIST).length;
      await events.type(
        within(dialog).getByLabelText(/Justificativa/),
        'Motivo',
      );

      await events.click(
        within(dialog).getByRole('button', { name: 'Recusar' }),
      );

      expect(
        await screen.findByText('Esta reunião já foi respondida.'),
      ).toBeVisible();
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(reads),
      );
    },
  );

  it('um erro de validação do servidor vai ao campo e o diálogo continua aberto', async () => {
    const { events } = setup([ANSWERABLE], {
      [REJECT]: {
        status: 422,
        body: {
          detail: [{ loc: ['body', 'reason'], msg: 'Justificativa inválida.' }],
        },
      },
    });
    const dialog = await openReason(events, /Recusar/, 'Recusar reunião');
    await events.type(within(dialog).getByLabelText(/Justificativa/), 'Motivo');

    await events.click(within(dialog).getByRole('button', { name: 'Recusar' }));

    expect(
      await within(dialog).findByText('Justificativa inválida.'),
    ).toBeVisible();
    expect(
      screen.getByRole('dialog', { name: 'Recusar reunião' }),
    ).toBeVisible();
  });
});

describe('Reuniões: cancelar com motivo e confirmação explícita (RNF21, RN10)', () => {
  const CANCEL = 'POST /api/reunioes/:id/cancelar';

  it('pede o motivo e avisa que não há volta, e só cancela no botão de confirmar', async () => {
    const { fetchMock, events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Cancelar a reunião/,
      'Cancelar reunião',
    );

    expect(
      within(dialog).getByText(/Esta ação não pode ser desfeita/),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar reunião' }),
    ).toBeDisabled();
    await events.type(
      within(dialog).getByLabelText(/Motivo/),
      'Tive um imprevisto.',
    );
    expect(bodiesTo(fetchMock, 'POST', '/cancelar')).toEqual([]);

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar reunião' }),
    );

    expect(await screen.findByText('Reunião cancelada.')).toBeVisible();
    expect(bodiesTo(fetchMock, 'POST', '/cancelar')).toEqual([
      { reason: 'Tive um imprevisto.' },
    ]);
    await waitFor(() =>
      expect(
        within(cardOf(/Pauta minha/)).getByText('Cancelada'),
      ).toBeVisible(),
    );
    const details = within(await openMeeting(events, /Pauta minha/));
    expect(
      details.getByText(/Motivo do cancelamento: Tive um imprevisto\./),
    ).toBeVisible();
  });

  it('a outra parte também cancela uma reunião aceita (RN10)', async () => {
    const { fetchMock, events } = setup([ACCEPTED_OF_OTHER]);
    const dialog = await openReason(
      events,
      /Cancelar a reunião/,
      'Cancelar reunião',
    );

    await events.type(within(dialog).getByLabelText(/Motivo/), 'Não poderei.');
    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar reunião' }),
    );

    expect(await screen.findByText('Reunião cancelada.')).toBeVisible();
    expect(bodiesTo(fetchMock, 'POST', '/cancelar')).toEqual([
      { reason: 'Não poderei.' },
    ]);
  });

  it('Voltar sem digitar fecha sem pedir confirmação e não cancela', async () => {
    const { fetchMock, events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Cancelar a reunião/,
      'Cancelar reunião',
    );

    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(bodiesTo(fetchMock, 'POST', '/cancelar')).toEqual([]);
  });

  it('com motivo digitado mostra o aviso no topo e pede confirmação antes de fechar (RNF28)', async () => {
    const { events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Cancelar a reunião/,
      'Cancelar reunião',
    );
    await events.type(within(dialog).getByLabelText(/Motivo/), 'Rascunho');

    expect(
      await within(dialog).findByText(/Você tem alterações não salvas/),
    ).toHaveTextContent('Clique em Cancelar reunião para gravá-las.');
    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));

    expect(
      await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
    ).toBeVisible();
  });

  it.each([404, 409])(
    'um %s mostra a mensagem, fecha o diálogo e atualiza a lista',
    async (status) => {
      const { fetchMock, events } = setup([OWN], {
        [CANCEL]: {
          status,
          body: { detail: 'Esta reunião já foi cancelada.' },
        },
      });
      const dialog = await openReason(
        events,
        /Cancelar a reunião/,
        'Cancelar reunião',
      );
      const reads = requestsTo(fetchMock, LIST).length;
      await events.type(within(dialog).getByLabelText(/Motivo/), 'Motivo');

      await events.click(
        within(dialog).getByRole('button', { name: 'Cancelar reunião' }),
      );

      expect(
        await screen.findByText('Esta reunião já foi cancelada.'),
      ).toBeVisible();
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(reads),
      );
    },
  );
});

const PATCH = 'PATCH /api/reunioes/:id';
const RN39 =
  /voltará a ficar pendente.*a outra parte precisará aceitar de novo/i;

const ACCEPTED_OWN = makeMeeting(5, {
  description: 'Pauta aceita minha',
  situation: 'accepted',
  status: 'accepted',
  can_edit: true,
  can_cancel: true,
});

/** Troca o valor de um campo nativo de data ou hora, que o teclado simulado não limpa bem. */
function change(dialog: HTMLElement, label: RegExp, value: string) {
  fireEvent.change(within(dialog).getByLabelText(label), {
    target: { value },
  });
}

const save = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: 'Salvar' });

describe('Reuniões: editar (RF21, RN39)', () => {
  it('reabre o diálogo com os valores atuais, em Santarém, sem o campo do aluno', async () => {
    const { events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    expect(within(dialog).getByLabelText(/Data/)).toHaveValue('2026-11-20');
    expect(within(dialog).getByLabelText(/Hora de início/)).toHaveValue(
      '14:30',
    );
    expect(within(dialog).getByLabelText(/Descrição/)).toHaveValue(
      'Pauta minha',
    );
    expect(within(dialog).queryByLabelText(/Aluno/)).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText(RN39)).not.toBeInTheDocument();
  });

  it('o professor edita sem escolher o aluno', async () => {
    const { events } = setup([OWN], {}, 'teacher');
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    expect(within(dialog).queryByLabelText(/Aluno/)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Descrição/)).toHaveValue(
      'Pauta minha',
    );
  });

  it('envia só o que mudou: mudar a descrição manda só a descrição', async () => {
    const { fetchMock, events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    await events.clear(within(dialog).getByLabelText(/Descrição/));
    await events.type(
      within(dialog).getByLabelText(/Descrição/),
      '  Nova pauta  ',
    );
    await events.click(save(dialog));

    expect(await screen.findByText('Reunião atualizada.')).toBeVisible();
    expect(bodiesTo(fetchMock, 'PATCH', '/1')).toEqual([]);
    expect(bodiesTo(fetchMock, 'PATCH', '/2')).toEqual([
      { description: 'Nova pauta' },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole('button', { name: /Nova pauta/ }),
    ).toBeVisible();
  });

  it('mudar só a hora manda só a hora', async () => {
    const { fetchMock, events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    change(dialog, /Hora de início/, '16:00');
    change(dialog, /Hora de término/, '17:00');
    await events.click(save(dialog));

    await screen.findByText('Reunião atualizada.');
    expect(bodiesTo(fetchMock, 'PATCH', '/2')).toEqual([
      { time: '16:00', end_time: '17:00' },
    ]);
  });

  it('mudar só o término manda só o término', async () => {
    const { fetchMock, events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );
    expect(within(dialog).getByLabelText(/Hora de término/)).toHaveValue(
      '15:30',
    );

    change(dialog, /Hora de término/, '16:00');
    await events.click(save(dialog));

    await screen.findByText('Reunião atualizada.');
    expect(bodiesTo(fetchMock, 'PATCH', '/2')).toEqual([{ end_time: '16:00' }]);
  });

  it('um término que não é depois do início mostra o erro e impede salvar', async () => {
    const { events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    change(dialog, /Hora de término/, '14:00');

    expect(
      await within(dialog).findByText(
        'A hora de término deve ser depois da hora de início.',
      ),
    ).toBeVisible();
    expect(save(dialog)).toBeDisabled();
  });

  it('numa reunião aceita, mudar só o término avisa que volta a pendente (RN39)', async () => {
    const { events } = setup([ACCEPTED_OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    change(dialog, /Hora de término/, '16:00');

    expect(await within(dialog).findByText(RN39)).toBeVisible();
  });

  it('numa reunião aceita, mudar a data ou a hora avisa antes de salvar que volta a pendente (RN39)', async () => {
    const { events } = setup([ACCEPTED_OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );
    expect(within(dialog).queryByText(RN39)).not.toBeInTheDocument();

    change(dialog, /Hora de início/, '16:00');

    expect(await within(dialog).findByText(RN39)).toBeVisible();
    change(dialog, /Hora de início/, '14:30');
    await waitFor(() =>
      expect(within(dialog).queryByText(RN39)).not.toBeInTheDocument(),
    );
    change(dialog, /Data/, '2099-12-30');
    expect(await within(dialog).findByText(RN39)).toBeVisible();
  });

  it('numa reunião aceita, mudar só a descrição não avisa', async () => {
    const { events } = setup([ACCEPTED_OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    await events.type(within(dialog).getByLabelText(/Descrição/), ' extra');

    await within(dialog).findByText(/Você tem alterações não salvas/);
    expect(within(dialog).queryByText(RN39)).not.toBeInTheDocument();
  });

  it('numa reunião pendente, mudar a data não avisa (ela já está pendente)', async () => {
    const { events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    change(dialog, /Data/, '2099-12-30');

    await within(dialog).findByText(/Você tem alterações não salvas/);
    expect(within(dialog).queryByText(RN39)).not.toBeInTheDocument();
  });

  it('salvar uma reunião aceita com a hora mudada a mostra como pendente na lista', async () => {
    const { events } = setup([ACCEPTED_OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    change(dialog, /Hora de início/, '16:00');
    change(dialog, /Hora de término/, '17:00');
    await events.click(save(dialog));

    await screen.findByText('Reunião atualizada.');
    await waitFor(() =>
      expect(
        within(cardOf(/Pauta aceita minha/)).getByText('Pendente'),
      ).toBeVisible(),
    );
  });

  it('sem nenhuma alteração fecha com o aviso e não envia', async () => {
    const { fetchMock, events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    await events.click(save(dialog));

    expect(
      await screen.findByText('Nenhuma alteração para salvar.'),
    ).toBeVisible();
    expect(bodiesTo(fetchMock, 'PATCH', '/2')).toEqual([]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('o horário atual já passado não bloqueia a edição de outro campo (o futuro só vale se ele mudar)', async () => {
    const { fetchMock, events } = setup([
      makeMeeting(6, {
        description: 'Pauta de horário vencido',
        scheduled_at: '2026-11-05T10:00:00-03:00',
      }),
    ]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    await events.type(within(dialog).getByLabelText(/Descrição/), ' ajustada');

    await waitFor(() => expect(save(dialog)).toBeEnabled());
    expect(
      within(dialog).queryByText('O horário deve ser futuro.'),
    ).not.toBeInTheDocument();
    await events.click(save(dialog));
    await screen.findByText('Reunião atualizada.');
    expect(bodiesTo(fetchMock, 'PATCH', '/6')).toEqual([
      { description: 'Pauta de horário vencido ajustada' },
    ]);
  });

  it('um horário que passou, quando a data ou a hora mudam, mostra o erro e bloqueia o envio', async () => {
    const { events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    change(dialog, /Data/, '2000-01-01');

    expect(
      await within(dialog).findByText('O horário deve ser futuro.'),
    ).toBeVisible();
    expect(save(dialog)).toBeDisabled();
  });

  it('com alteração mostra o aviso no topo e pede confirmação antes de fechar; voltar ao original tira o aviso (RNF28)', async () => {
    const { events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    await events.type(within(dialog).getByLabelText(/Descrição/), 'x');
    expect(
      await within(dialog).findByText(/Você tem alterações não salvas/),
    ).toHaveTextContent('Clique em Salvar para gravá-las.');
    await events.type(
      within(dialog).getByLabelText(/Descrição/),
      '{Backspace}',
    );
    await waitFor(() =>
      expect(
        within(dialog).queryByText(/Você tem alterações não salvas/),
      ).not.toBeInTheDocument(),
    );

    await events.type(within(dialog).getByLabelText(/Descrição/), 'y');
    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
    ).toBeVisible();
  });

  it.each([404, 409])(
    'um %s mostra a mensagem do servidor, fecha o diálogo e atualiza a lista',
    async (status) => {
      const { fetchMock, events } = setup([OWN], {
        [PATCH]: {
          status,
          body: { detail: 'Esta reunião não pode mais ser editada.' },
        },
      });
      const dialog = await openReason(
        events,
        /Editar a reunião/,
        'Editar reunião',
      );
      const reads = requestsTo(fetchMock, LIST).length;
      await events.type(within(dialog).getByLabelText(/Descrição/), ' mais');

      await events.click(save(dialog));

      expect(
        await screen.findByText('Esta reunião não pode mais ser editada.'),
      ).toBeVisible();
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(reads),
      );
    },
  );

  it('um erro de validação do servidor vai ao campo e o diálogo continua aberto', async () => {
    const { events } = setup([OWN], {
      [PATCH]: {
        status: 422,
        body: {
          detail: [
            { loc: ['body', 'description'], msg: 'Descrição inválida.' },
          ],
        },
      },
    });
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );
    await events.type(within(dialog).getByLabelText(/Descrição/), ' mais');

    await events.click(save(dialog));

    expect(
      await within(dialog).findByText('Descrição inválida.'),
    ).toBeVisible();
    expect(
      screen.getByRole('dialog', { name: 'Editar reunião' }),
    ).toBeVisible();
  });
});

describe('Reuniões: a orientação encerrou durante uma ação', () => {
  const ME = 'GET /api/auth/me';
  const ENDED = {
    status: 409,
    body: { detail: 'A orientação foi encerrada.' },
  };

  it.each([
    ['aceitar', 'POST /api/reunioes/:id/responder', [ANSWERABLE], /Aceitar/],
    ['editar', 'PATCH /api/reunioes/:id', [OWN], /Editar a reunião/],
    [
      'cancelar',
      'POST /api/reunioes/:id/cancelar',
      [OWN],
      /Cancelar a reunião/,
    ],
  ] as const)(
    'ao %s, o 409 atualiza também a sessão, para o menu refletir o fim',
    async (action, route, meetings, button) => {
      const { fetchMock, events } = setup([...meetings], { [route]: ENDED });
      await openMeeting(events);
      const reads = requestsTo(fetchMock, ME).length;

      if (action === 'aceitar') {
        await events.click(screen.getByRole('button', { name: button }));
      } else {
        const title =
          action === 'editar' ? 'Editar reunião' : 'Cancelar reunião';
        await events.click(screen.getByRole('button', { name: button }));
        const dialog = await screen.findByRole('dialog', { name: title });
        await events.type(
          within(dialog).getByLabelText(/Descrição|Motivo/),
          ' x',
        );
        await events.click(
          within(dialog).getByRole('button', {
            name: action === 'editar' ? 'Salvar' : 'Cancelar reunião',
          }),
        );
      }

      expect(
        await screen.findByText('A orientação foi encerrada.'),
      ).toBeVisible();
      await waitFor(() =>
        expect(requestsTo(fetchMock, ME).length).toBeGreaterThan(reads),
      );
    },
  );

  it('a recusa também atualiza a sessão', async () => {
    const { fetchMock, events } = setup([ANSWERABLE], {
      'POST /api/reunioes/:id/responder': ENDED,
    });
    const dialog = await openReason(events, /Recusar/, 'Recusar reunião');
    const reads = requestsTo(fetchMock, ME).length;
    await events.type(within(dialog).getByLabelText(/Justificativa/), 'Motivo');

    await events.click(within(dialog).getByRole('button', { name: 'Recusar' }));

    await screen.findByText('A orientação foi encerrada.');
    await waitFor(() =>
      expect(requestsTo(fetchMock, ME).length).toBeGreaterThan(reads),
    );
  });
});

describe('Reuniões: editar uma descrição com espaços nas pontas', () => {
  it('mudar só a hora não reenvia a descrição, que só difere pelos espaços', async () => {
    const { fetchMock, events } = setup([
      makeMeeting(7, { description: '  Pauta com espaços  ' }),
    ]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();

    change(dialog, /Hora de início/, '16:00');
    change(dialog, /Hora de término/, '17:00');
    await events.click(save(dialog));

    await screen.findByText('Reunião atualizada.');
    expect(bodiesTo(fetchMock, 'PATCH', '/7')).toEqual([
      { time: '16:00', end_time: '17:00' },
    ]);
  });
});

const MARKABLE = makeMeeting(8, {
  description: 'Pauta para marcar',
  scheduled_at: '2026-11-24T14:30:00-03:00',
  situation: 'accepted',
  status: 'accepted',
  author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
  counterpart: { id: 101, full_name: 'Maria Lima' },
  can_answer: false,
  can_edit: true,
  can_cancel: true,
  can_mark_held: true,
});
const MARK = 'POST /api/reunioes/:id/realizada';
const MARK_BUTTON = { name: /Marcar como realizada a reunião/ };

describe('Reuniões: marcar como realizada (RF57, RN43)', () => {
  it('a ação aparece só quando a API indica que o professor pode marcar', async () => {
    const { events } = setup([MARKABLE, OWN, ANSWERABLE], {}, 'teacher');

    const markable = within(await openMeeting(events, /Pauta para marcar/));
    expect(markable.getByRole('button', MARK_BUTTON)).toBeVisible();
    await events.click(markable.getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    for (const description of [/Pauta minha/, /Pauta para responder/]) {
      const other = within(await openMeeting(events, description));
      expect(other.queryByRole('button', MARK_BUTTON)).not.toBeInTheDocument();
      await events.click(other.getByRole('button', { name: 'Fechar' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
    }
  });

  it('a confirmação diz que é irreversível e que não edita nem cancela, e só marca ao confirmar', async () => {
    const { fetchMock, events } = setup([MARKABLE], {}, 'teacher');
    await openMeeting(events, /Pauta para marcar/);

    await events.click(screen.getByRole('button', MARK_BUTTON));

    const dialog = await screen.findByRole('dialog', {
      name: 'Marcar reunião como realizada',
    });
    expect(dialog).toHaveAccessibleDescription(
      /Esta ação não pode ser desfeita.*deixa de poder ser editada ou cancelada/,
    );
    expect(bodiesTo(fetchMock, 'POST', '/realizada')).toEqual([]);

    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(bodiesTo(fetchMock, 'POST', '/realizada')).toEqual([]);
    expect(
      within(cardOf(/Pauta para marcar/)).getByText('Aceita'),
    ).toBeVisible();
  });

  it('ao confirmar, a reunião passa a aparecer como realizada, sem editar nem cancelar, e a lista é atualizada', async () => {
    const { fetchMock, events } = setup([MARKABLE], {}, 'teacher');
    await openMeeting(events, /Pauta para marcar/);
    await events.click(screen.getByRole('button', MARK_BUTTON));
    const dialog = await screen.findByRole('dialog', {
      name: 'Marcar reunião como realizada',
    });
    const reads = requestsTo(fetchMock, LIST).length;

    await events.click(
      within(dialog).getByRole('button', { name: 'Marcar como realizada' }),
    );

    expect(
      await screen.findByText('Reunião marcada como realizada.'),
    ).toBeVisible();
    expect(bodiesTo(fetchMock, 'POST', '/realizada')).toEqual([{}]);
    await waitFor(() =>
      expect(
        within(cardOf(/Pauta para marcar/)).getByText('Realizada'),
      ).toBeVisible(),
    );
    expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(reads);
    const details = within(await openMeeting(events, /Pauta para marcar/));
    for (const name of [/Editar/, /Cancelar/, /Marcar como realizada/]) {
      expect(details.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('o botão fica ocupado durante o envio e a marcação sai uma vez só', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup(
      [MARKABLE],
      {
        [MARK]: async () => {
          await gate;
          return {
            status: 200,
            body: { ...MARKABLE, held_at: '2026-11-10T12:00:00-03:00' },
          };
        },
      },
      'teacher',
    );
    await openMeeting(events, /Pauta para marcar/);
    await events.click(screen.getByRole('button', MARK_BUTTON));
    const dialog = await screen.findByRole('dialog', {
      name: 'Marcar reunião como realizada',
    });

    await events.click(
      within(dialog).getByRole('button', { name: 'Marcar como realizada' }),
    );

    const busy = await within(dialog).findByRole('button', {
      name: 'Marcando…',
    });
    expect(busy).toBeDisabled();
    // Um segundo clique, mesmo forçado, não envia de novo.
    fireEvent.click(busy);
    release();
    await screen.findByText('Reunião marcada como realizada.');
    expect(bodiesTo(fetchMock, 'POST', '/realizada')).toHaveLength(1);
  });

  it.each([404, 409])(
    'um %s mostra a mensagem do servidor, fecha o diálogo e recarrega a lista',
    async (status) => {
      const { fetchMock, events } = setup(
        [MARKABLE],
        {
          [MARK]: {
            status,
            body: { detail: 'O horário desta reunião já passou.' },
          },
        },
        'teacher',
      );
      await openMeeting(events, /Pauta para marcar/);
      await events.click(screen.getByRole('button', MARK_BUTTON));
      const dialog = await screen.findByRole('dialog', {
        name: 'Marcar reunião como realizada',
      });
      const reads = requestsTo(fetchMock, LIST).length;

      await events.click(
        within(dialog).getByRole('button', { name: 'Marcar como realizada' }),
      );

      expect(
        await screen.findByText('O horário desta reunião já passou.'),
      ).toBeVisible();
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(reads),
      );
    },
  );

  it('uma falha do servidor mostra a mensagem em português e deixa tentar de novo', async () => {
    const { events } = setup(
      [MARKABLE],
      { [MARK]: { status: 500, body: {} } },
      'teacher',
    );
    await openMeeting(events, /Pauta para marcar/);
    await events.click(screen.getByRole('button', MARK_BUTTON));
    const dialog = await screen.findByRole('dialog', {
      name: 'Marcar reunião como realizada',
    });

    await events.click(
      within(dialog).getByRole('button', { name: 'Marcar como realizada' }),
    );

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Marcar como realizada' }),
      ).toBeEnabled(),
    );
  });

  it('a orientação encerrada durante a marcação atualiza também a sessão', async () => {
    const { fetchMock, events } = setup(
      [MARKABLE],
      {
        [MARK]: { status: 404, body: { detail: 'Reunião não encontrada.' } },
      },
      'teacher',
    );
    await openMeeting(events, /Pauta para marcar/);
    await events.click(screen.getByRole('button', MARK_BUTTON));
    const dialog = await screen.findByRole('dialog', {
      name: 'Marcar reunião como realizada',
    });
    const reads = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(
      within(dialog).getByRole('button', { name: 'Marcar como realizada' }),
    );

    await screen.findByText('Reunião não encontrada.');
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET /api/auth/me').length).toBeGreaterThan(
        reads,
      ),
    );
  });

  it('funciona em tela pequena', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { events } = setup([MARKABLE], {}, 'teacher');
    await openMeeting(events, /Pauta para marcar/);

    await events.click(screen.getByRole('button', MARK_BUTTON));

    expect(
      await screen.findByRole('dialog', {
        name: 'Marcar reunião como realizada',
      }),
    ).toBeVisible();
  });
});

const HELD = makeMeeting(9, {
  description: 'Pauta realizada',
  scheduled_at: '2026-11-05T14:30:00-03:00',
  situation: 'held',
  status: 'accepted',
  author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
  counterpart: { id: 101, full_name: 'Maria Lima' },
  can_answer: false,
  can_edit: false,
  can_cancel: false,
  can_edit_notes: true,
});
const NOTES = 'PUT /api/reunioes/:id/apontamentos';
const ADD_NOTES = { name: /Adicionar apontamentos da reunião/ };
const EDIT_NOTES = { name: /Editar apontamentos da reunião/ };

async function openNotes(
  events: ReturnType<typeof userEvent.setup>,
  button = ADD_NOTES,
  meeting: string | RegExp = /Pauta realizada/,
) {
  await openMeeting(events, meeting);
  await events.click(screen.getByRole('button', button));
  return screen.findByRole('dialog', { name: 'Apontamentos da reunião' });
}

describe('Reuniões: apontamentos da reunião realizada (RF58, RN44)', () => {
  it('o professor vê Adicionar sem apontamentos e Editar com apontamentos, só quando a API indica', async () => {
    const { events } = setup(
      [
        HELD,
        makeMeeting(10, {
          ...HELD,
          description: 'Pauta com texto',
          scheduled_at: '2026-11-06T14:30:00-03:00',
          notes: 'Combinamos a entrega.',
        }),
        makeMeeting(11, {
          ...HELD,
          description: 'Pauta congelada',
          scheduled_at: '2026-11-07T14:30:00-03:00',
          notes: 'Texto final.',
          can_edit_notes: false,
        }),
      ],
      {},
      'teacher',
    );

    const empty = within(await openMeeting(events, /Pauta realizada/));
    expect(empty.getByRole('button', ADD_NOTES)).toBeVisible();
    expect(empty.queryByRole('button', EDIT_NOTES)).not.toBeInTheDocument();
    await events.click(empty.getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    const filled = within(await openMeeting(events, /Pauta com texto/));
    expect(filled.getByRole('button', EDIT_NOTES)).toBeVisible();
    expect(filled.getByText('Combinamos a entrega.')).toBeVisible();
    await events.click(filled.getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    const frozen = within(await openMeeting(events, /Pauta congelada/));
    expect(frozen.getByText('Texto final.')).toBeVisible();
    expect(frozen.queryByRole('button', ADD_NOTES)).not.toBeInTheDocument();
    expect(frozen.queryByRole('button', EDIT_NOTES)).not.toBeInTheDocument();
  });

  it('adiciona apontamentos com o contador, salva o texto aparado e a lista é atualizada', async () => {
    const { fetchMock, events } = setup([HELD], {}, 'teacher');
    const dialog = await openNotes(events);
    const field = within(dialog).getByLabelText('Apontamentos');
    expect(within(dialog).getByText('0/3000')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeDisabled();

    await events.type(field, '  Definimos o escopo.  ');
    expect(within(dialog).getByText('19/3000')).toBeVisible();
    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Apontamentos salvos.')).toBeVisible();
    expect(bodiesTo(fetchMock, 'PUT', '/apontamentos')).toEqual([
      { notes: 'Definimos o escopo.' },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    const details = within(await openMeeting(events, /Pauta realizada/));
    expect(details.getByText('Definimos o escopo.')).toBeVisible();
    expect(details.getByRole('button', EDIT_NOTES)).toBeVisible();
  });

  it('o contador é lido junto do campo, para o leitor de tela, antes de passar do limite', async () => {
    const { events } = setup([HELD], {}, 'teacher');
    const dialog = await openNotes(events);
    const field = within(dialog).getByLabelText('Apontamentos');

    await events.type(field, 'Abc');

    expect(field).toHaveAccessibleDescription('3/3000');
  });

  it('o texto longo passa do limite: mostra o erro e bloqueia o envio; no limite exato salva', async () => {
    const { events } = setup([HELD], {}, 'teacher');
    const dialog = await openNotes(events);
    const field = within(dialog).getByLabelText('Apontamentos');

    await events.click(field);
    await events.paste('a'.repeat(3001));

    expect(
      await within(dialog).findByText(
        'Os apontamentos devem ter no máximo 3000 caracteres.',
      ),
    ).toBeVisible();
    expect(within(dialog).getByText('3001/3000')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeDisabled();

    await events.clear(field);
    await events.click(field);
    await events.paste(`  ${'a'.repeat(3000)}  `);

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Salvar' }),
      ).toBeEnabled(),
    );
  });

  it('edita os apontamentos existentes, e preserva as quebras de linha ao exibir', async () => {
    const withNotes = makeMeeting(9, {
      ...HELD,
      notes: 'Linha um\nLinha dois',
    });
    const { fetchMock, events } = setup([withNotes], {}, 'teacher');
    const detailsBefore = within(await openMeeting(events, /Pauta realizada/));
    expect(detailsBefore.getByText(/Linha um/)).toHaveStyle({
      whiteSpace: 'pre-wrap',
    });
    await events.click(detailsBefore.getByRole('button', EDIT_NOTES));
    const dialog = await screen.findByRole('dialog', {
      name: 'Apontamentos da reunião',
    });
    const field = within(dialog).getByLabelText('Apontamentos');
    expect(field).toHaveValue('Linha um\nLinha dois');

    await events.type(field, ' e três');
    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Apontamentos salvos.');
    expect(bodiesTo(fetchMock, 'PUT', '/apontamentos')).toEqual([
      { notes: 'Linha um\nLinha dois e três' },
    ]);
  });

  it('texto vazio remove os apontamentos, depois de uma confirmação explícita', async () => {
    const withNotes = makeMeeting(9, { ...HELD, notes: 'Para remover.' });
    const { fetchMock, events } = setup([withNotes], {}, 'teacher');
    const dialog = await openNotes(events, EDIT_NOTES);
    await events.clear(within(dialog).getByLabelText('Apontamentos'));
    await events.type(within(dialog).getByLabelText('Apontamentos'), '   ');

    await events.click(within(dialog).getByRole('button', { name: 'Remover' }));

    const confirm = await screen.findByRole('dialog', {
      name: 'Remover os apontamentos?',
    });
    expect(confirm).toHaveAccessibleDescription(/não pode ser desfeita/);
    expect(bodiesTo(fetchMock, 'PUT', '/apontamentos')).toEqual([]);
    await events.click(
      within(confirm).getByRole('button', { name: 'Remover apontamentos' }),
    );

    expect(await screen.findByText('Apontamentos removidos.')).toBeVisible();
    expect(bodiesTo(fetchMock, 'PUT', '/apontamentos')).toEqual([
      { notes: '' },
    ]);
  });

  it('Voltar na confirmação da remoção não remove nada', async () => {
    const withNotes = makeMeeting(9, { ...HELD, notes: 'Fica.' });
    const { fetchMock, events } = setup([withNotes], {}, 'teacher');
    const dialog = await openNotes(events, EDIT_NOTES);
    await events.clear(within(dialog).getByLabelText('Apontamentos'));
    await events.click(within(dialog).getByRole('button', { name: 'Remover' }));
    const confirm = await screen.findByRole('dialog', {
      name: 'Remover os apontamentos?',
    });

    await events.click(within(confirm).getByRole('button', { name: 'Voltar' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Remover os apontamentos?' }),
      ).not.toBeInTheDocument(),
    );
    expect(bodiesTo(fetchMock, 'PUT', '/apontamentos')).toEqual([]);
  });

  it('sem apontamentos, salvar vazio não é oferecido', async () => {
    const { events } = setup([HELD], {}, 'teacher');
    const dialog = await openNotes(events);

    await events.type(within(dialog).getByLabelText('Apontamentos'), '   ');

    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeDisabled();
  });

  it('fechar com alterações não salvas avisa antes de descartar (RNF28)', async () => {
    const { fetchMock, events } = setup([HELD], {}, 'teacher');
    const dialog = await openNotes(events);
    await events.type(
      within(dialog).getByLabelText('Apontamentos'),
      'Rascunho',
    );
    expect(
      await within(dialog).findByText(/Você tem alterações não salvas/),
    ).toBeVisible();

    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));

    const discard = await screen.findByRole('dialog', {
      name: 'Descartar alterações?',
    });
    await events.click(
      within(discard).getByRole('button', { name: 'Continuar editando' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Apontamentos da reunião' }),
    ).toBeVisible();
    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));
    await events.click(
      await screen.findByRole('button', { name: 'Sair sem salvar' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(bodiesTo(fetchMock, 'PUT', '/apontamentos')).toEqual([]);
  });

  it('o botão fica ocupado durante o envio e o texto sai uma vez só', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup(
      [HELD],
      {
        [NOTES]: async () => {
          await gate;
          return { status: 200, body: HELD };
        },
      },
      'teacher',
    );
    const dialog = await openNotes(events);
    await events.type(within(dialog).getByLabelText('Apontamentos'), 'Texto');

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const busy = await within(dialog).findByRole('button', {
      name: 'Salvando…',
    });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    release();
    await screen.findByText('Apontamentos salvos.');
    expect(bodiesTo(fetchMock, 'PUT', '/apontamentos')).toHaveLength(1);
  });

  it.each([404, 409])(
    'um %s mostra a mensagem do servidor, fecha o diálogo e recarrega a lista',
    async (status) => {
      const { fetchMock, events } = setup(
        [HELD],
        {
          [NOTES]: {
            status,
            body: { detail: 'Só uma reunião realizada pode ter apontamentos.' },
          },
        },
        'teacher',
      );
      const dialog = await openNotes(events);
      await events.type(within(dialog).getByLabelText('Apontamentos'), 'Texto');
      const reads = requestsTo(fetchMock, LIST).length;

      await events.click(
        within(dialog).getByRole('button', { name: 'Salvar' }),
      );

      expect(
        await screen.findByText(
          'Só uma reunião realizada pode ter apontamentos.',
        ),
      ).toBeVisible();
      await waitFor(() =>
        expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(reads),
      );
    },
  );

  it('uma falha do servidor mostra a mensagem em português e deixa tentar de novo', async () => {
    const { events } = setup(
      [HELD],
      { [NOTES]: { status: 500, body: {} } },
      'teacher',
    );
    const dialog = await openNotes(events);
    await events.type(within(dialog).getByLabelText('Apontamentos'), 'Texto');

    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      await within(dialog).findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Salvar' }),
      ).toBeEnabled(),
    );
  });

  it('o aluno lê os apontamentos, sem ações de adicionar, editar ou remover', async () => {
    const { events } = setup(
      [
        makeMeeting(9, {
          ...HELD,
          author: { id: 7, full_name: 'Ana Souza', type: 'student' },
          counterpart: { id: 9, full_name: 'Carlos Lima' },
          notes: 'Combinamos a entrega do capítulo.',
          can_edit_notes: false,
        }),
      ],
      {},
      'student',
    );

    const details = within(await openMeeting(events, /Pauta realizada/));

    expect(
      details.getByText('Combinamos a entrega do capítulo.'),
    ).toBeVisible();
    expect(details.queryByRole('button', ADD_NOTES)).not.toBeInTheDocument();
    expect(details.queryByRole('button', EDIT_NOTES)).not.toBeInTheDocument();
  });

  it('o aluno não vê bloco vazio quando a reunião realizada não tem apontamentos', async () => {
    const { events } = setup(
      [
        makeMeeting(9, {
          ...HELD,
          author: { id: 7, full_name: 'Ana Souza', type: 'student' },
          counterpart: { id: 9, full_name: 'Carlos Lima' },
          can_edit_notes: false,
        }),
      ],
      {},
      'student',
    );

    const details = within(await openMeeting(events, /Pauta realizada/));

    expect(
      details.queryByRole('region', { name: 'Apontamentos' }),
    ).not.toBeInTheDocument();
    expect(details.queryByText('Apontamentos')).not.toBeInTheDocument();
  });

  it('funciona em tela pequena', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { events } = setup([HELD], {}, 'teacher');

    const dialog = await openNotes(events);

    expect(within(dialog).getByLabelText('Apontamentos')).toBeVisible();
  });
});
