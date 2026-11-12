import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupCalendarTest, teardownCalendarTest } from '../test/calendarClock';
import { tokenStore } from '../services/tokenStore';
import { makeMeeting, meetingsServer } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const PERIOD = 'GET /api/reunioes/calendario';
const STUDENT_PATH = '/aluno/reunioes';
const TEACHER_PATH = '/professor/reunioes';

function setup(
  meetings: FakeMeeting[],
  user: 'student' | 'teacher',
  {
    active = true,
    path = user === 'student' ? STUDENT_PATH : TEACHER_PATH,
  } = {},
) {
  const server = meetingsServer(meetings, { user, active });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(path);
  return { fetchMock, events, server };
}

/** O cartão da reunião no calendário: um botão cujo nome traz horário, outra parte, situação e descrição. */
function cardOf(text: string | RegExp) {
  return screen.getByRole('button', { name: text });
}

function periodsRequested(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, PERIOD).map(([input]) => {
    const params = new URL(String(input), 'http://localhost').searchParams;
    return { from: params.get('date_from'), to: params.get('date_to') };
  });
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

describe('MeetingsPage: o calendário do Mês', () => {
  it('abre no mês atual, com a barra própria e sem a listagem, a tabela, os filtros nem a paginação', async () => {
    setup([makeMeeting(1)], 'student');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reuniões' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Novembro de 2026',
      }),
    ).toBeVisible();
    await screen.findByRole('button', { name: /Carlos Lima/ });

    for (const name of ['Hoje', 'Mês anterior', 'Próximo mês']) {
      expect(screen.getByRole('button', { name })).toBeVisible();
    }
    expect(screen.queryByRole('table', { name: 'Reuniões' })).toBeNull();
    expect(screen.queryByLabelText('Situação')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: /Paginação/ }),
    ).not.toBeInTheDocument();
    for (const name of [/Fazer upgrade/i, /Buscar/i, /Ajuda/i, /Configura/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('tem a semana começando no domingo e os textos em português', async () => {
    setup([], 'student');
    await screen.findByRole('heading', { level: 2, name: 'Novembro de 2026' });

    const headers = (await screen.findAllByRole('columnheader')).map(
      (header) => header.textContent,
    );

    expect(headers[0]).toContain('domingo');
    expect(headers[6]).toContain('sábado');
  });

  it('mostra em cada reunião o horário em Santarém, a outra parte e a situação com texto e ícone', async () => {
    setup(
      [
        makeMeeting(1, {
          scheduled_at: '2026-11-20T14:30:00-03:00',
          counterpart: { id: 9, full_name: 'Carlos Lima' },
        }),
      ],
      'student',
    );

    const card = await screen.findByRole('button', { name: /Carlos Lima/ });

    expect(within(card).getByText('14:30–15:30')).toBeVisible();
    expect(within(card).getByText('Carlos Lima')).toBeVisible();
    const chip = within(card).getByText('Pendente');
    expect(chip.closest('.MuiChip-root')?.querySelector('svg')).not.toBeNull();
  });

  it.each([
    ['pending', 'Pendente'],
    ['accepted', 'Aceita'],
    ['rejected', 'Recusada'],
    ['cancelled', 'Cancelada'],
    ['held', 'Realizada'],
    ['expired', 'Expirada'],
  ] as const)(
    'mostra a situação %s como a etiqueta %s, com ícone',
    async (situation, label) => {
      setup([makeMeeting(1, { situation })], 'student');

      const card = await screen.findByRole('button', { name: /Carlos Lima/ });

      const chip = within(card).getByText(label);
      expect(chip).toBeVisible();
      expect(
        chip.closest('.MuiChip-root')?.querySelector('svg'),
      ).not.toBeNull();
    },
  );

  it('abre o modal da reunião ao clicar no cartão, com as informações e o motivo do cancelamento', async () => {
    const { events } = setup(
      [
        makeMeeting(1, {
          scheduled_at: '2026-11-20T14:30:00-03:00',
          description: 'Revisar o capítulo 2',
          situation: 'cancelled',
          status: 'cancelled',
          cancellation_reason: 'Tive um imprevisto.',
          can_edit: false,
          can_cancel: false,
        }),
      ],
      'student',
    );

    await events.click(
      await screen.findByRole('button', { name: /capítulo 2/ }),
    );

    const dialog = await screen.findByRole('dialog', { name: 'Reunião' });
    expect(
      within(dialog).getByText('20 de novembro de 2026, das 14:30 às 15:30'),
    ).toBeVisible();
    expect(within(dialog).getByText('Revisar o capítulo 2')).toBeVisible();
    expect(within(dialog).getByText('Com: Carlos Lima')).toBeVisible();
    expect(within(dialog).getByText('Cancelada')).toBeVisible();
    expect(
      within(dialog).getByText(/Motivo do cancelamento: Tive um imprevisto\./),
    ).toBeVisible();
    expect(within(dialog).getByText('Solicitada por Você')).toBeVisible();
    await events.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('mostra o motivo da recusa e indica o cancelamento feito pelo sistema a partir da marcação, não do texto', async () => {
    const { events } = setup(
      [
        makeMeeting(1, {
          scheduled_at: '2026-11-18T09:00:00-03:00',
          situation: 'rejected',
          status: 'rejected',
          rejection_reason: 'Estarei em viagem.',
          description: 'Recusada',
        }),
        makeMeeting(2, {
          scheduled_at: '2026-11-19T09:00:00-03:00',
          situation: 'cancelled',
          status: 'cancelled',
          cancelled_by_system: true,
          cancellation_reason: 'Motivo do sistema.',
          description: 'Do sistema',
        }),
        makeMeeting(3, {
          scheduled_at: '2026-11-21T09:00:00-03:00',
          situation: 'cancelled',
          status: 'cancelled',
          cancelled_by_system: false,
          cancellation_reason: 'Motivo do sistema.',
          description: 'Texto igual, mas pelo autor',
        }),
      ],
      'student',
    );

    await events.click(await screen.findByRole('button', { name: /Recusada/ }));
    expect(
      await screen.findByText(/Motivo da recusa: Estarei em viagem\./),
    ).toBeVisible();
    await events.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await events.click(cardOf(/Do sistema/));
    expect(await screen.findByText('Cancelada pelo sistema')).toBeVisible();
    await events.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await events.click(cardOf(/pelo autor/));
    await screen.findByRole('dialog', { name: 'Reunião' });
    expect(
      screen.queryByText('Cancelada pelo sistema'),
    ).not.toBeInTheDocument();
  });

  it('mostra a outra parte como solicitante quando foi ela quem pediu', async () => {
    const { events } = setup(
      [
        makeMeeting(1, {
          author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
          counterpart: { id: 9, full_name: 'Carlos Lima' },
        }),
      ],
      'student',
    );

    await events.click(
      await screen.findByRole('button', { name: /Carlos Lima/ }),
    );

    const dialog = await screen.findByRole('dialog', { name: 'Reunião' });
    expect(
      within(dialog).getByText('Solicitada por Carlos Lima'),
    ).toBeVisible();
  });

  it('mostra o calendário do professor, com o aluno no cartão e o botão de solicitar', async () => {
    setup(
      [
        makeMeeting(1, {
          author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
          counterpart: { id: 101, full_name: 'Maria Lima' },
        }),
      ],
      'teacher',
    );

    const card = await screen.findByRole('button', { name: /Maria Lima/ });

    expect(within(card).getByText('Maria Lima')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Solicitar reunião' }),
    ).toBeVisible();
  });
});

describe('MeetingsPage: a navegação entre os períodos', () => {
  it('lê o período exibido, a grade de 6 semanas, e lê o novo ao mudar de mês', async () => {
    const { fetchMock, events } = setup(
      [
        makeMeeting(1, {
          scheduled_at: '2026-11-20T14:30:00-03:00',
          description: 'De novembro',
        }),
        makeMeeting(2, {
          scheduled_at: '2026-12-15T09:00:00-03:00',
          description: 'De dezembro',
        }),
      ],
      'student',
    );
    await screen.findByRole('button', { name: /De novembro/ });
    expect(periodsRequested(fetchMock)).toEqual([
      { from: '2026-11-01', to: '2026-12-12' },
    ]);

    await events.click(screen.getByRole('button', { name: 'Próximo mês' }));

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Dezembro de 2026',
      }),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: /De dezembro/ }),
    ).toBeVisible();
    expect(periodsRequested(fetchMock).at(-1)?.from).toBe('2026-11-29');
  });

  it('as setas andam um mês por vez e Hoje volta ao mês atual', async () => {
    const { events } = setup([], 'student');
    const title = (name: string) =>
      screen.findByRole('heading', { level: 2, name });
    await title('Novembro de 2026');

    await events.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await title('Outubro de 2026');
    await events.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await title('Setembro de 2026');
    await events.click(screen.getByRole('button', { name: 'Hoje' }));

    await title('Novembro de 2026');
  });

  it('anuncia a mudança de período numa região de estado', async () => {
    const { events } = setup([], 'student');
    await screen.findByRole('heading', { level: 2, name: 'Novembro de 2026' });

    await events.click(screen.getByRole('button', { name: 'Próximo mês' }));

    const announced = within(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Dezembro de 2026',
      }),
    ).getByRole('status');
    expect(announced).toHaveAttribute('aria-live', 'polite');
    expect(announced).toHaveTextContent('Dezembro de 2026');
  });
});

describe('MeetingsPage: ao recarregar', () => {
  it('mantém as reuniões já lidas enquanto o período é lido de novo', async () => {
    const server = meetingsServer(
      [makeMeeting(1, { description: 'Pauta fixa' })],
      { user: 'student' },
    );
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    const original = server.routes[PERIOD]!;
    server.routes[PERIOD] = async (body, url, params) => {
      reads += 1;
      if (reads > 1) await gate;
      return typeof original === 'function'
        ? original(body, url, params)
        : original;
    };
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(STUDENT_PATH);
    await screen.findByRole('button', { name: /Pauta fixa/ });

    await events.click(screen.getByRole('button', { name: 'Hoje' }));
    await events.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await events.click(screen.getByRole('button', { name: 'Mês anterior' }));

    expect(screen.getByRole('button', { name: /Pauta fixa/ })).toBeVisible();
    release();
  });
});

describe('MeetingsPage: a visão salva', () => {
  it('abre no Mês sem preferência e o seletor deixa Dia e Semana indisponíveis por ora', async () => {
    setup([], 'student');
    await screen.findByRole('heading', { level: 2, name: 'Novembro de 2026' });

    expect(screen.getByRole('button', { name: 'Mês' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Dia' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Semana' })).toBeDisabled();
  });

  it('guarda a visão no navegador, separada por usuário, sem pedir nada', async () => {
    const { events } = setup([], 'student');
    await screen.findByRole('heading', { level: 2, name: 'Novembro de 2026' });
    window.localStorage.removeItem('sigtcc:reunioes:visao:7');

    await events.click(screen.getByRole('button', { name: 'Mês' }));
    // Clicar na visão já escolhida não a desmarca, e a preferência fica guardada para o usuário 7.
    expect(screen.getByRole('button', { name: 'Mês' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('segue funcionando quando o navegador não deixa guardar a preferência', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    setup([makeMeeting(1)], 'student');

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Novembro de 2026',
      }),
    ).toBeVisible();
    vi.restoreAllMocks();
  });
});

describe('MeetingsPage: estados', () => {
  it('sem reuniões no período mostra o aviso, com o calendário e o botão de solicitar', async () => {
    setup([], 'student');

    expect(
      await screen.findByText('Nenhuma reunião neste período.'),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Novembro de 2026' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Solicitar reunião' }),
    ).toBeVisible();
  });

  it('sem orientação ativa mas com histórico o calendário é só de leitura, sem o botão de solicitar', async () => {
    setup(
      [
        makeMeeting(1, {
          situation: 'cancelled',
          status: 'cancelled',
          cancelled_by_system: true,
          cancellation_reason: 'Cancelada pelo sistema.',
          description: 'Histórico',
        }),
      ],
      'student',
      { active: false },
    );

    await screen.findByRole('button', { name: /Histórico/ });

    expect(
      screen.queryByRole('button', { name: 'Solicitar reunião' }),
    ).not.toBeInTheDocument();
  });

  it('mostra o andamento enquanto carrega e oferece Tentar novamente quando falha', async () => {
    const server = meetingsServer([makeMeeting(1)], { user: 'student' });
    let failing = true;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = server.routes[PERIOD]!;
    server.routes[PERIOD] = async (body, url, params) => {
      await gate;
      if (failing) return { status: 500, body: {} };
      return typeof original === 'function'
        ? original(body, url, params)
        : original;
    };
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(STUDENT_PATH);

    expect(
      await screen.findByRole('progressbar', {
        name: 'Carregando as reuniões do período',
      }),
    ).toBeVisible();
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    failing = false;
    await events.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(
      await screen.findByRole('button', { name: /Carlos Lima/ }),
    ).toBeVisible();
  });

  it('funciona em tela pequena, com a barra, o calendário e o modal', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { events } = setup(
      [makeMeeting(1, { description: 'No celular' })],
      'student',
    );

    const card = await screen.findByRole('button', { name: /No celular/ });
    expect(screen.getByRole('button', { name: 'Hoje' })).toBeVisible();
    await events.click(card);

    const dialog = await screen.findByRole('dialog', { name: 'Reunião' });
    expect(within(dialog).getByText('No celular')).toBeVisible();
  });
});
