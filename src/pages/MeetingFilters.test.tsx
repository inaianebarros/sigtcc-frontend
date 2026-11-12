import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { setupCalendarTest, teardownCalendarTest } from '../test/calendarClock';
import { makeMeeting, meetingsServer } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const PERIOD = 'GET /api/reunioes/calendario';
const ADVISEES = 'GET /api/orientacao/orientandos/calendario';

const ADVISEE_LIST = [
  { id: 101, full_name: 'Ana Ativa', ended: false },
  { id: 102, full_name: 'Bruno Encerrado', ended: true },
  { id: 103, full_name: 'José Álvaro', ended: false },
];

function meetingWith(
  id: number,
  student: { id: number; full_name: string },
  overrides: Partial<FakeMeeting> = {},
) {
  return makeMeeting(id, {
    scheduled_at: `2026-11-${10 + id}T09:00:00-03:00`,
    counterpart: student,
    student_id: student.id,
    description: `Pauta de ${student.full_name}`,
    ...overrides,
  });
}

const MEETINGS = [
  meetingWith(1, ADVISEE_LIST[0]!),
  meetingWith(2, ADVISEE_LIST[1]!, {
    situation: 'accepted',
    status: 'accepted',
  }),
  meetingWith(3, ADVISEE_LIST[2]!, {
    situation: 'rejected',
    status: 'rejected',
  }),
];

function setup(
  user: 'student' | 'teacher',
  {
    meetings = MEETINGS,
    advisees = ADVISEE_LIST,
  }: { meetings?: FakeMeeting[]; advisees?: typeof ADVISEE_LIST } = {},
) {
  const server = meetingsServer(meetings, {
    user,
    calendarAdvisees: advisees,
  });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(user === 'student' ? '/aluno/reunioes' : '/professor/reunioes');
  return { fetchMock, events, server };
}

const card = (text: string | RegExp) =>
  screen.getByRole('button', { name: text });
const queryCard = (text: string | RegExp) =>
  screen.queryByRole('button', { name: text });

function lastParams(
  fetchMock: ReturnType<typeof mockApi>,
  route: string,
): URLSearchParams {
  const calls = requestsTo(fetchMock, route);
  return new URL(String(calls.at(-1)![0]), 'http://localhost').searchParams;
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

describe('Filtros do calendário: o professor', () => {
  it('vê Situação e Orientandos, tudo marcado, com a orientação encerrada indicada', async () => {
    setup('teacher');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });

    const situation = screen.getByRole('group', { name: 'Situação' });
    for (const label of [
      'Pendente',
      'Aceita',
      'Recusada',
      'Cancelada',
      'Realizada',
      'Expirada',
    ]) {
      expect(
        within(situation).getByRole('checkbox', { name: label }),
      ).toBeChecked();
    }
    const advisees = screen.getByRole('group', { name: 'Orientandos' });
    expect(
      await within(advisees).findByRole('checkbox', { name: /Ana Ativa/ }),
    ).toBeChecked();
    expect(
      within(advisees).getByRole('checkbox', { name: /Bruno Encerrado/ }),
    ).toBeChecked();
    expect(
      within(advisees).getByRole('checkbox', { name: /José Álvaro/ }),
    ).toBeChecked();
    expect(within(advisees).getAllByText('Orientação encerrada')).toHaveLength(
      1,
    );
    expect(
      within(advisees).getByRole('checkbox', {
        name: /Bruno Encerrado.*Orientação encerrada/,
      }),
    ).toBeInTheDocument();
    expect(within(advisees).getByLabelText('Buscar orientando')).toBeVisible();
  });

  it('desmarcar um orientando tira as reuniões dele do calendário no servidor, e marcar de novo as traz', async () => {
    const { fetchMock, events } = setup('teacher');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    const advisees = screen.getByRole('group', { name: 'Orientandos' });

    await events.click(
      await within(advisees).findByRole('checkbox', { name: /Ana Ativa/ }),
    );

    await waitFor(() => expect(queryCard(/Pauta de Ana Ativa/)).toBeNull());
    expect(card(/Pauta de Bruno Encerrado/)).toBeVisible();
    expect(lastParams(fetchMock, PERIOD).getAll('hidden_student_ids')).toEqual([
      '101',
    ]);

    await events.click(
      within(advisees).getByRole('checkbox', { name: /Ana Ativa/ }),
    );

    expect(
      await screen.findByRole('button', { name: /Pauta de Ana Ativa/ }),
    ).toBeVisible();
    expect(lastParams(fetchMock, PERIOD).getAll('hidden_student_ids')).toEqual(
      [],
    );
  });

  it('desligar uma situação esconde as reuniões dela, e com todas ligadas nenhuma situação é enviada', async () => {
    const { fetchMock, events } = setup('teacher');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    expect(lastParams(fetchMock, PERIOD).getAll('situation')).toEqual([]);

    await events.click(screen.getByRole('checkbox', { name: 'Recusada' }));

    await waitFor(() => expect(queryCard(/Pauta de José Álvaro/)).toBeNull());
    expect(card(/Pauta de Ana Ativa/)).toBeVisible();
    expect(lastParams(fetchMock, PERIOD).getAll('situation').sort()).toEqual([
      'accepted',
      'cancelled',
      'expired',
      'held',
      'pending',
    ]);

    await events.click(screen.getByRole('checkbox', { name: 'Recusada' }));

    expect(
      await screen.findByRole('button', { name: /Pauta de José Álvaro/ }),
    ).toBeVisible();
    expect(lastParams(fetchMock, PERIOD).getAll('situation')).toEqual([]);
  });

  it('busca o orientando no servidor, sem diferenciar maiúsculas e acentos', async () => {
    const { fetchMock, events } = setup('teacher');
    const advisees = await screen.findByRole('group', { name: 'Orientandos' });
    await within(advisees).findByRole('checkbox', { name: /Ana Ativa/ });

    await events.type(
      within(advisees).getByLabelText('Buscar orientando'),
      'JOSE alvaro',
    );

    await waitFor(
      () =>
        expect(lastParams(fetchMock, ADVISEES).get('search')).toBe(
          'JOSE alvaro',
        ),
      {
        timeout: 3000,
      },
    );
    await waitFor(() =>
      expect(
        within(advisees).queryByRole('checkbox', { name: /Ana Ativa/ }),
      ).toBeNull(),
    );
    expect(
      within(advisees).getByRole('checkbox', { name: /José Álvaro/ }),
    ).toBeInTheDocument();
  });

  it('a lista é paginada, e o orientando desmarcado continua oculto ao trocar de página', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      id: 200 + index,
      full_name: `Aluno ${String(index + 1).padStart(2, '0')}`,
      ended: false,
    }));
    const { fetchMock, events } = setup('teacher', {
      advisees: many,
      meetings: [meetingWith(1, many[0]!)],
    });
    const advisees = await screen.findByRole('group', { name: 'Orientandos' });
    await events.click(
      await within(advisees).findByRole('checkbox', { name: /Aluno 01/ }),
    );
    expect(
      within(advisees).queryByRole('checkbox', { name: /Aluno 11/ }),
    ).toBeNull();

    await events.click(
      within(advisees).getByRole('button', { name: 'Ir para a página 2' }),
    );

    expect(
      await within(advisees).findByRole('checkbox', { name: /Aluno 11/ }),
    ).toBeChecked();
    expect(
      within(advisees).getByRole('checkbox', { name: /Aluno 12/ }),
    ).toBeInTheDocument();
    expect(lastParams(fetchMock, ADVISEES).get('offset')).toBe('10');
    expect(lastParams(fetchMock, PERIOD).getAll('hidden_student_ids')).toEqual([
      '200',
    ]);
    await events.click(
      within(advisees).getByRole('button', { name: 'Ir para a página 1' }),
    );
    expect(
      await within(advisees).findByRole('checkbox', { name: /Aluno 01/ }),
    ).not.toBeChecked();
  });

  it('o botão Marcar todos os orientandos volta a mostrar todos', async () => {
    const { fetchMock, events } = setup('teacher');
    const advisees = await screen.findByRole('group', { name: 'Orientandos' });
    await events.click(
      await within(advisees).findByRole('checkbox', { name: /Ana Ativa/ }),
    );
    await events.click(
      within(advisees).getByRole('checkbox', { name: /José Álvaro/ }),
    );

    await events.click(
      await within(advisees).findByRole('button', {
        name: 'Marcar todos os orientandos',
      }),
    );

    await waitFor(() =>
      expect(
        lastParams(fetchMock, PERIOD).getAll('hidden_student_ids'),
      ).toEqual([]),
    );
    expect(
      within(advisees).getByRole('checkbox', { name: /Ana Ativa/ }),
    ).toBeChecked();
  });

  it('mantém o período e a visão ao mudar o filtro', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:9', 'week');
    const { fetchMock, events } = setup('teacher');
    await screen.findByRole('heading', {
      level: 2,
      name: '8 – 14 de novembro de 2026',
    });
    const before = lastParams(fetchMock, PERIOD);

    await events.click(screen.getByRole('checkbox', { name: 'Recusada' }));

    await waitFor(() =>
      expect(lastParams(fetchMock, PERIOD).getAll('situation')).not.toEqual([]),
    );
    expect(lastParams(fetchMock, PERIOD).get('date_from')).toBe(
      before.get('date_from'),
    );
    expect(lastParams(fetchMock, PERIOD).get('date_to')).toBe(
      before.get('date_to'),
    );
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
  });
});

describe('Filtros do calendário: o aluno', () => {
  it('vê só a Situação, sem a seção de orientandos nem a leitura deles', async () => {
    const { fetchMock } = setup('student');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });

    expect(screen.getByRole('group', { name: 'Situação' })).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Orientandos' }),
    ).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, ADVISEES)).toHaveLength(0);
  });

  it('desligar uma situação esconde as reuniões dela', async () => {
    const { events } = setup('student');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });

    await events.click(screen.getByRole('checkbox', { name: 'Aceita' }));

    await waitFor(() =>
      expect(queryCard(/Pauta de Bruno Encerrado/)).toBeNull(),
    );
    expect(card(/Pauta de Ana Ativa/)).toBeVisible();
  });
});

describe('Filtros do calendário: estados', () => {
  it('falha na leitura filtrada: mostra o erro e não deixa na grade reuniões que não correspondem aos filtros', async () => {
    const server = meetingsServer(MEETINGS, {
      user: 'student',
      calendarAdvisees: ADVISEE_LIST,
    });
    let failing = false;
    const original = server.routes[PERIOD]!;
    server.routes[PERIOD] = async (body, url, params) => {
      if (failing) return { status: 500, body: {} };
      return typeof original === 'function'
        ? original(body, url, params)
        : original;
    };
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp('/aluno/reunioes');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    failing = true;

    await events.click(screen.getByRole('checkbox', { name: 'Aceita' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    expect(queryCard(/Pauta de Ana Ativa/)).toBeNull();
  });

  it('o professor vê o aviso de carregamento enquanto a lista de orientandos não chega', async () => {
    const server = meetingsServer(MEETINGS, {
      user: 'teacher',
      calendarAdvisees: ADVISEE_LIST,
    });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = server.routes[ADVISEES]!;
    server.routes[ADVISEES] = async (body, url, params) => {
      await gate;
      return typeof original === 'function'
        ? original(body, url, params)
        : original;
    };
    mockApi(server.routes);
    renderApp('/professor/reunioes');

    expect(
      await screen.findByText('Carregando orientandos…'),
    ).toBeInTheDocument();
    release();
    await within(screen.getByRole('group', { name: 'Orientandos' })).findByRole(
      'checkbox',
      { name: /Ana Ativa/ },
    );
    expect(
      screen.queryByText('Carregando orientandos…'),
    ).not.toBeInTheDocument();
  });

  it('sem reuniões depois de filtrar, explica e sugere ligar os filtros, que os religa', async () => {
    const { events } = setup('teacher');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    await events.click(screen.getByRole('checkbox', { name: 'Pendente' }));
    await events.click(screen.getByRole('checkbox', { name: 'Aceita' }));
    await events.click(screen.getByRole('checkbox', { name: 'Recusada' }));

    expect(
      await screen.findByText(
        'Nenhuma reunião com esses filtros. Ligue mais filtros para ver outras reuniões.',
      ),
    ).toBeVisible();
    await events.click(
      screen.getByRole('button', { name: 'Ligar todos os filtros' }),
    );

    expect(
      await screen.findByRole('button', { name: /Pauta de Ana Ativa/ }),
    ).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Recusada' })).toBeChecked();
  });

  it('sem nenhuma situação marcada não lê o servidor nem mostra reuniões, e avisa', async () => {
    const { fetchMock, events } = setup('student');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    const reads = requestsTo(fetchMock, PERIOD).length;

    for (const label of [
      'Pendente',
      'Aceita',
      'Recusada',
      'Cancelada',
      'Realizada',
      'Expirada',
    ]) {
      await events.click(screen.getByRole('checkbox', { name: label }));
    }

    expect(
      await screen.findByText(/Nenhuma reunião com esses filtros/),
    ).toBeVisible();
    expect(queryCard(/Pauta de Ana Ativa/)).toBeNull();
    // As desmarcações intermediárias leem; a última, sem nenhuma situação, não.
    const afterAll = requestsTo(fetchMock, PERIOD).length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(requestsTo(fetchMock, PERIOD).length).toBe(afterAll);
    expect(afterAll).toBeGreaterThan(reads);
  });

  it('nada é guardado: ao reabrir a tela, todos os filtros voltam ligados', async () => {
    const first = setup('teacher');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    await first.events.click(
      screen.getByRole('checkbox', { name: 'Recusada' }),
    );
    await first.events.click(
      await within(
        screen.getByRole('group', { name: 'Orientandos' }),
      ).findByRole('checkbox', {
        name: /Ana Ativa/,
      }),
    );
    expect(window.localStorage.length).toBe(0);
    expect(window.location.search).toBe('');
  });

  it('anuncia o resultado do filtro numa região de estado', async () => {
    const { events } = setup('teacher');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });
    expect(
      await screen.findByText('3 reuniões no período.'),
    ).toBeInTheDocument();

    await events.click(screen.getByRole('checkbox', { name: 'Recusada' }));

    expect(
      await screen.findByText('2 reuniões no período.'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 reuniões no período.')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('em tela pequena o painel é uma seção recolhível, fechada ao abrir', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { events } = setup('teacher');
    await screen.findByRole('button', { name: /Pauta de Ana Ativa/ });

    const toggle = screen.getByRole('button', { name: 'Filtros' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('group', { name: 'Situação' }),
    ).not.toBeInTheDocument();

    await events.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Situação' })).toBeVisible();
  });
});
