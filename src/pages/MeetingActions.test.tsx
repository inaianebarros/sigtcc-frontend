import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { makeMeeting, meetingsServer } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const PATH = '/aluno/reunioes';
const LIST = 'GET /api/reunioes';

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
  author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
  can_answer: true,
  can_edit: false,
  can_cancel: false,
});
const OWN = makeMeeting(2, {
  description: 'Pauta minha',
  can_answer: false,
  can_edit: true,
  can_cancel: true,
});
const NONE = makeMeeting(3, {
  description: 'Pauta sem ações',
  situation: 'expired',
  can_answer: false,
  can_edit: false,
  can_cancel: false,
});

function rowOf(text: string | RegExp) {
  return screen.getByRole('row', { name: text });
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
});

describe('Reuniões: as ações aparecem só quando a flag do servidor é verdadeira', () => {
  it('mostra Aceitar e Recusar só com can_answer, e Editar e Cancelar só com as suas flags', async () => {
    setup([ANSWERABLE, OWN, NONE]);
    await screen.findByText('Pauta minha');

    const answerable = within(rowOf(/Pauta para responder/));
    expect(answerable.getByRole('button', { name: /Aceitar/ })).toBeVisible();
    expect(answerable.getByRole('button', { name: /Recusar/ })).toBeVisible();
    expect(
      answerable.queryByRole('button', { name: /Editar/ }),
    ).not.toBeInTheDocument();
    expect(
      answerable.queryByRole('button', { name: /Cancelar/ }),
    ).not.toBeInTheDocument();

    const own = within(rowOf(/Pauta minha/));
    expect(own.getByRole('button', { name: /Editar/ })).toBeVisible();
    expect(own.getByRole('button', { name: /Cancelar/ })).toBeVisible();
    expect(
      own.queryByRole('button', { name: /Aceitar/ }),
    ).not.toBeInTheDocument();
    expect(
      own.queryByRole('button', { name: /Recusar/ }),
    ).not.toBeInTheDocument();

    expect(
      within(rowOf(/Pauta sem ações/)).queryAllByRole('button'),
    ).toHaveLength(0);
  });

  it('cada botão tem um nome acessível com a reunião, para o leitor de tela distinguir as linhas', async () => {
    setup([ANSWERABLE, OWN]);
    await screen.findByText('Pauta minha');

    expect(
      screen.getByRole('button', {
        name: 'Aceitar a reunião "Pauta para responder"',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Editar a reunião "Pauta minha"' }),
    ).toBeVisible();
  });

  it('no celular as mesmas ações aparecem no cartão', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup([ANSWERABLE, NONE]);

    const card = await screen.findByRole('article', {
      name: /Pauta para responder/,
    });

    expect(within(card).getByRole('button', { name: /Aceitar/ })).toBeVisible();
    expect(within(card).getByRole('button', { name: /Recusar/ })).toBeVisible();
    expect(
      within(
        screen.getByRole('article', { name: /Pauta sem ações/ }),
      ).queryAllByRole('button'),
    ).toHaveLength(0);
  });
});

describe('Reuniões: aceitar', () => {
  it('aceita direto, sem diálogo, avisa e atualiza a lista', async () => {
    const { fetchMock, events } = setup([ANSWERABLE]);
    await screen.findByText('Pauta para responder');

    await events.click(screen.getByRole('button', { name: /Aceitar/ }));

    expect(await screen.findByText('Reunião aceita.')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodiesTo(fetchMock, 'POST', '/responder')).toEqual([
      { action: 'accept' },
    ]);
    await waitFor(() =>
      expect(
        within(rowOf(/Pauta para responder/)).getByText('Aceita'),
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
    await screen.findByText('Pauta para responder');

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
      await screen.findByText('Pauta para responder');
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
    await screen.findByText('Pauta para responder');

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
) {
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
      within(rowOf(/Pauta para responder/)).getByText('Recusada'),
    ).toBeVisible();
    expect(
      within(rowOf(/Pauta para responder/)).getByText(
        /Motivo da recusa: Estarei em viagem\./,
      ),
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
      expect(within(rowOf(/Pauta minha/)).getByText('Cancelada')).toBeVisible(),
    );
    expect(
      within(rowOf(/Pauta minha/)).getByText(
        /Motivo do cancelamento: Tive um imprevisto\./,
      ),
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

    expect(within(dialog).getByLabelText(/Data/)).toHaveValue('2099-12-31');
    expect(within(dialog).getByLabelText(/Hora/)).toHaveValue('14:30');
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
    expect(await screen.findByText('Nova pauta')).toBeVisible();
  });

  it('mudar só a hora manda só a hora', async () => {
    const { fetchMock, events } = setup([OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );

    change(dialog, /Hora/, '16:00');
    await events.click(save(dialog));

    await screen.findByText('Reunião atualizada.');
    expect(bodiesTo(fetchMock, 'PATCH', '/2')).toEqual([{ time: '16:00' }]);
  });

  it('numa reunião aceita, mudar a data ou a hora avisa antes de salvar que volta a pendente (RN39)', async () => {
    const { events } = setup([ACCEPTED_OWN]);
    const dialog = await openReason(
      events,
      /Editar a reunião/,
      'Editar reunião',
    );
    expect(within(dialog).queryByText(RN39)).not.toBeInTheDocument();

    change(dialog, /Hora/, '16:00');

    expect(await within(dialog).findByText(RN39)).toBeVisible();
    change(dialog, /Hora/, '14:30');
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

    change(dialog, /Hora/, '16:00');
    await events.click(save(dialog));

    await screen.findByText('Reunião atualizada.');
    await waitFor(() =>
      expect(
        within(rowOf(/Pauta aceita minha/)).getByText('Pendente'),
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
        scheduled_at: '2000-01-01T10:00:00-03:00',
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
      await screen.findByRole('button', { name: button });
      const reads = requestsTo(fetchMock, ME).length;

      if (action === 'aceitar') {
        await events.click(screen.getByRole('button', { name: button }));
      } else {
        const title =
          action === 'editar' ? 'Editar reunião' : 'Cancelar reunião';
        const dialog = await openReason(events, button, title);
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

    change(dialog, /Hora/, '16:00');
    await events.click(save(dialog));

    await screen.findByText('Reunião atualizada.');
    expect(bodiesTo(fetchMock, 'PATCH', '/7')).toEqual([{ time: '16:00' }]);
  });
});
