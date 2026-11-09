import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { makeAdvisee } from '../test/adviseesApi';
import type { FakeAdvisee } from '../test/adviseesApi';
import { makeMeeting, meetingsServer } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const STUDENT_PATH = '/aluno/reunioes';
const TEACHER_PATH = '/professor/reunioes';
const CREATE = 'POST /api/reunioes';
const ENDED =
  'A orientação foi encerrada. A reunião não pode mais ser solicitada';

const ADVISEES: FakeAdvisee[] = [
  makeAdvisee(1, {
    student: {
      id: 101,
      full_name: 'Maria Lima',
      course: { id: 1, name: 'BCC' },
    },
    thesis_topic: 'Gestão de TCC com Django',
  }),
  makeAdvisee(2, {
    student: {
      id: 102,
      full_name: 'João Reis',
      course: { id: 1, name: 'BCC' },
    },
    thesis_topic: null,
  }),
];

type Overrides = Record<
  string,
  MockResponse | ((body: unknown) => MockResponse | Promise<MockResponse>)
>;

function setup(
  user: 'student' | 'teacher',
  {
    meetings = [] as FakeMeeting[],
    overrides = {} as Overrides,
    path = user === 'student' ? STUDENT_PATH : TEACHER_PATH,
  } = {},
) {
  const server = meetingsServer(meetings, {
    user,
    advisees: ADVISEES,
    overrides: overrides as never,
  });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(path);
  return { fetchMock, events, server };
}

async function openDialog(events: ReturnType<typeof userEvent.setup>) {
  await events.click(
    await screen.findByRole('button', { name: 'Solicitar reunião' }),
  );
  return screen.findByRole('dialog', { name: 'Solicitar reunião' });
}

async function fill(
  events: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  values: { date?: string; time?: string; description?: string },
) {
  if (values.date !== undefined)
    await events.type(within(dialog).getByLabelText(/Data/), values.date);
  if (values.time !== undefined)
    await events.type(within(dialog).getByLabelText(/Hora/), values.time);
  if (values.description !== undefined)
    await events.type(
      within(dialog).getByLabelText(/Descrição/),
      values.description,
    );
}

const submit = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: 'Solicitar' });

function postBodies(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, CREATE).map(
    ([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>,
  );
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Solicitar reunião: o aluno', () => {
  it('abre com data e hora nativas e a descrição, e o botão desabilitado', async () => {
    const { events } = setup('student');

    const dialog = await openDialog(events);

    expect(within(dialog).getByLabelText(/Data/)).toHaveAttribute(
      'type',
      'date',
    );
    expect(within(dialog).getByLabelText(/Hora/)).toHaveAttribute(
      'type',
      'time',
    );
    expect(within(dialog).getByLabelText(/Descrição/)).toBeVisible();
    expect(submit(dialog)).toBeDisabled();
    expect(
      within(dialog).queryByRole('combobox', { name: 'Aluno' }),
    ).not.toBeInTheDocument();
  });

  it('envia a data, a hora e a descrição aparada, avisa, fecha e mostra a reunião na lista', async () => {
    const { fetchMock, events } = setup('student');
    const dialog = await openDialog(events);
    await fill(events, dialog, {
      date: '2099-12-31',
      time: '14:30',
      description: '  Revisar o capítulo 2  ',
    });

    expect(submit(dialog)).toBeEnabled();
    await events.click(submit(dialog));

    expect(await screen.findByText('Reunião solicitada.')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Solicitar reunião' }),
      ).not.toBeInTheDocument(),
    );
    expect(postBodies(fetchMock)).toEqual([
      {
        date: '2099-12-31',
        time: '14:30',
        description: 'Revisar o capítulo 2',
      },
    ]);
    expect(await screen.findByText('Revisar o capítulo 2')).toBeVisible();
  });

  it('conta os caracteres e só habilita com 1 a 500 caracteres, sem contar as pontas', async () => {
    const { events } = setup('student');
    const dialog = await openDialog(events);
    await fill(events, dialog, { date: '2099-12-31', time: '14:30' });
    const description = within(dialog).getByLabelText(/Descrição/);
    expect(within(dialog).getByText('0/500')).toBeVisible();

    await events.type(description, '    ');
    expect(submit(dialog)).toBeDisabled();

    await events.type(description, 'a');
    expect(within(dialog).getByText('1/500')).toBeVisible();
    expect(submit(dialog)).toBeEnabled();

    await events.clear(description);
    await events.click(description);
    await events.paste('x'.repeat(501));
    expect(submit(dialog)).toBeDisabled();
    expect(
      await within(dialog).findByText(
        'A descrição deve ter no máximo 500 caracteres.',
      ),
    ).toBeVisible();

    await events.clear(description);
    await events.paste('y'.repeat(500));
    expect(submit(dialog)).toBeEnabled();
  });

  it('um horário que já passou desabilita o botão e mostra o erro', async () => {
    const { events } = setup('student');
    const dialog = await openDialog(events);

    await fill(events, dialog, {
      date: '2000-01-01',
      time: '10:00',
      description: 'Pauta',
    });

    expect(submit(dialog)).toBeDisabled();
    expect(
      await within(dialog).findByText('O horário deve ser futuro.'),
    ).toBeVisible();
  });

  it('lê a data e a hora em Santarém, e não no fuso do navegador', async () => {
    const { events } = setup('student');
    const dialog = await openDialog(events);
    const inFiveMinutes = new Date(Date.now() + 5 * 60_000);
    // O mesmo instante, escrito no horário de Santarém (UTC-3, sem horário de verão).
    const local = new Date(inFiveMinutes.getTime() - 3 * 3_600_000)
      .toISOString()
      .slice(0, 16);

    await fill(events, dialog, {
      date: local.slice(0, 10),
      time: local.slice(11, 16),
      description: 'Daqui a pouco',
    });

    expect(submit(dialog)).toBeEnabled();
    await events.clear(within(dialog).getByLabelText(/Hora/));
    const earlier = new Date(
      inFiveMinutes.getTime() - 3 * 3_600_000 - 10 * 60_000,
    )
      .toISOString()
      .slice(11, 16);
    await events.type(within(dialog).getByLabelText(/Hora/), earlier);
    expect(submit(dialog)).toBeDisabled();
  });

  it('leva o erro do servidor ao campo e mantém o diálogo aberto com o texto', async () => {
    const { events } = setup('student', {
      overrides: {
        [CREATE]: {
          status: 422,
          body: {
            detail: [
              {
                loc: ['body', 'payload', 'date'],
                msg: 'A data e a hora devem ser posteriores ao momento atual.',
                type: 'value_error',
              },
            ],
          },
        },
      },
    });
    const dialog = await openDialog(events);
    await fill(events, dialog, {
      date: '2099-12-31',
      time: '14:30',
      description: 'Pauta',
    });

    await events.click(submit(dialog));

    expect(
      await within(dialog).findByText(
        'A data e a hora devem ser posteriores ao momento atual.',
      ),
    ).toBeVisible();
    expect(within(dialog).getByLabelText(/Descrição/)).toHaveValue('Pauta');
  });

  it('mostra o andamento e não deixa enviar de novo enquanto o pedido está em curso', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetchMock, events } = setup('student', {
      overrides: {
        [CREATE]: async () => {
          await gate;
          return { status: 201, body: makeMeeting(9) };
        },
      },
    });
    const dialog = await openDialog(events);
    await fill(events, dialog, {
      date: '2099-12-31',
      time: '14:30',
      description: 'Pauta',
    });

    await events.click(submit(dialog));

    expect(
      await within(dialog).findByRole('button', { name: 'Solicitando…' }),
    ).toBeDisabled();
    release();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Solicitar reunião' }),
      ).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, CREATE)).toHaveLength(1);
  });
});

describe('Solicitar reunião: alterações não salvas (RNF28)', () => {
  it('sem conteúdo, Cancelar fecha direto', async () => {
    const { events } = setup('student');
    const dialog = await openDialog(events);
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Solicitar reunião' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
    ).not.toBeInTheDocument();
  });

  it('com conteúdo mostra o aviso no topo e pede confirmação antes de fechar', async () => {
    const { events } = setup('student');
    const dialog = await openDialog(events);
    await fill(events, dialog, { description: 'Rascunho' });

    expect(
      await within(dialog).findByText(/Você tem alterações não salvas/),
    ).toHaveTextContent('Clique em Solicitar para gravá-las.');
    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    await events.click(
      await screen.findByRole('button', { name: 'Continuar editando' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
      ).not.toBeInTheDocument(),
    );
    expect(within(dialog).getByLabelText(/Descrição/)).toHaveValue('Rascunho');
  });

  it('sair da tela por um link do menu com conteúdo digitado pede confirmação', async () => {
    const { events } = setup('student');
    const dialog = await openDialog(events);
    await fill(events, dialog, { description: 'Rascunho' });

    await events.click(
      screen.getByRole('link', { name: 'Meu perfil', hidden: true }),
    );

    expect(
      await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
    ).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(STUDENT_PATH);
  });
});

describe('Solicitar reunião: o professor', () => {
  it('exige o aluno, escolhido por {nome} - {tema}, e envia o student_id', async () => {
    const { fetchMock, events } = setup('teacher');
    const dialog = await openDialog(events);
    await fill(events, dialog, {
      date: '2099-12-31',
      time: '14:30',
      description: 'Pauta',
    });
    expect(submit(dialog)).toBeDisabled();

    await events.click(within(dialog).getByRole('combobox', { name: 'Aluno' }));
    await events.click(
      await screen.findByRole('option', { name: 'João Reis - Sem tema' }),
    );

    expect(submit(dialog)).toBeEnabled();
    await events.click(submit(dialog));

    expect(await screen.findByText('Reunião solicitada.')).toBeVisible();
    expect(postBodies(fetchMock)).toEqual([
      {
        date: '2099-12-31',
        time: '14:30',
        description: 'Pauta',
        student_id: 102,
      },
    ]);
  });

  it('já vem com o aluno do filtro escolhido e isso não conta como alteração', async () => {
    const { events } = setup('teacher', {
      meetings: [
        makeMeeting(1, {
          description: 'Da Maria',
          student_id: 101,
          counterpart: { id: 101, full_name: 'Maria Lima' },
        }),
      ],
      path: '/professor/reunioes?aluno=101',
    });
    await screen.findByText('Da Maria');

    const dialog = await openDialog(events);

    expect(within(dialog).getByRole('combobox', { name: 'Aluno' })).toHaveValue(
      'Maria Lima',
    );
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();
  });
});

describe('Solicitar reunião: orientação encerrada com o diálogo aberto', () => {
  it('um 409 do aluno mostra a mensagem, mantém o texto sem edição, bloqueia o envio e atualiza o menu', async () => {
    const { fetchMock, server, events } = setup('student', {
      overrides: {
        [CREATE]: () => {
          server.endAdvising();
          return {
            status: 409,
            body: { detail: 'Você precisa ter um orientador ativo.' },
          };
        },
      },
    });
    const dialog = await openDialog(events);
    await fill(events, dialog, {
      date: '2099-12-31',
      time: '14:30',
      description: 'Pauta',
    });
    const meBefore = requestsTo(fetchMock, 'GET /api/auth/me').length;

    await events.click(submit(dialog));

    expect(await within(dialog).findByText(ENDED)).toBeVisible();
    expect(within(dialog).getByLabelText(/Descrição/)).toHaveValue('Pauta');
    expect(within(dialog).getByLabelText(/Descrição/)).toBeDisabled();
    expect(
      within(dialog).queryByRole('button', { name: 'Solicitar' }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET /api/auth/me').length).toBeGreaterThan(
        meBefore,
      ),
    );
    await events.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Solicitar reunião' }),
      ).not.toBeInTheDocument(),
    );
    // Com o diálogo aberto o menu fica fora da árvore de acessibilidade: confere-se depois.
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    await waitFor(() =>
      expect(
        within(menu).getByRole('button', { name: /Reuniões/ }),
      ).toHaveAttribute('aria-disabled', 'true'),
    );
  });

  it('um 404 do professor mostra a mesma mensagem', async () => {
    const { events } = setup('teacher', {
      overrides: {
        [CREATE]: { status: 404, body: { detail: 'Aluno não encontrado.' } },
      },
    });
    const dialog = await openDialog(events);
    await fill(events, dialog, {
      date: '2099-12-31',
      time: '14:30',
      description: 'Pauta',
    });
    await events.click(within(dialog).getByRole('combobox', { name: 'Aluno' }));
    await events.click(
      await screen.findByRole('option', { name: 'João Reis - Sem tema' }),
    );

    await events.click(submit(dialog));

    expect(await within(dialog).findByText(ENDED)).toBeVisible();
  });

  it.each([
    ['o aluno com 404', 'student', 404],
    ['o professor com 409', 'teacher', 409],
  ] as const)(
    '%s não é orientação encerrada: mostra o erro do servidor e deixa tentar de novo',
    async (_name, user, status) => {
      const { events } = setup(user, {
        overrides: {
          [CREATE]: { status, body: { detail: 'Não foi possível solicitar.' } },
        },
      });
      const dialog = await openDialog(events);
      await fill(events, dialog, {
        date: '2099-12-31',
        time: '14:30',
        description: 'Pauta',
      });
      if (user === 'teacher') {
        await events.click(
          within(dialog).getByRole('combobox', { name: 'Aluno' }),
        );
        await events.click(
          await screen.findByRole('option', { name: 'João Reis - Sem tema' }),
        );
      }

      await events.click(submit(dialog));

      expect(
        await within(dialog).findByText('Não foi possível solicitar.'),
      ).toBeVisible();
      expect(within(dialog).queryByText(ENDED)).not.toBeInTheDocument();
      expect(within(dialog).getByLabelText(/Descrição/)).toBeEnabled();
      expect(submit(dialog)).toBeEnabled();
    },
  );
});
