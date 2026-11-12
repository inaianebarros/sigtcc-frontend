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

describe('MeetingsPage: as visões Dia e Semana', () => {
  const title = (name: string | RegExp) =>
    screen.findByRole('heading', { level: 2, name });

  it('trocar de visão mantém o período em torno da data exibida e lê só o que é exibido', async () => {
    const { fetchMock, events } = setup([], 'student');
    await title('Novembro de 2026');

    await events.click(screen.getByRole('button', { name: 'Semana' }));
    await title('8 – 14 de novembro de 2026');
    await events.click(screen.getByRole('button', { name: 'Dia' }));
    await title('Terça-feira, 10 de novembro de 2026');
    await events.click(screen.getByRole('button', { name: 'Mês' }));
    await title('Novembro de 2026');

    const periods = periodsRequested(fetchMock);
    expect(periods).toContainEqual({ from: '2026-11-08', to: '2026-11-14' });
    expect(periods).toContainEqual({ from: '2026-11-10', to: '2026-11-10' });
    expect(periods.at(-1)).toEqual({ from: '2026-11-01', to: '2026-12-12' });
    for (const { from, to } of periods) {
      const days =
        (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
          86_400_000 +
        1;
      expect(days).toBeLessThanOrEqual(42);
    }
  });

  it('as setas e Hoje andam um dia na visão Dia, com os nomes acessíveis certos', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:7', 'day');
    const { fetchMock, events } = setup([], 'student');
    await title('Terça-feira, 10 de novembro de 2026');

    await events.click(screen.getByRole('button', { name: 'Próximo dia' }));
    await title('Quarta-feira, 11 de novembro de 2026');
    await events.click(screen.getByRole('button', { name: 'Dia anterior' }));
    await events.click(screen.getByRole('button', { name: 'Dia anterior' }));
    await title('Segunda-feira, 9 de novembro de 2026');
    await events.click(screen.getByRole('button', { name: 'Hoje' }));

    await title('Terça-feira, 10 de novembro de 2026');
    expect(periodsRequested(fetchMock)).toContainEqual({
      from: '2026-11-11',
      to: '2026-11-11',
    });
  });

  it('as setas andam uma semana na visão Semana, e o título descreve a semana que cruza dois meses', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:7', 'week');
    const { fetchMock, events } = setup([], 'student');
    await title('8 – 14 de novembro de 2026');

    await events.click(screen.getByRole('button', { name: 'Próxima semana' }));
    await events.click(screen.getByRole('button', { name: 'Próxima semana' }));
    await events.click(screen.getByRole('button', { name: 'Próxima semana' }));

    const crossing = await title('29 de novembro – 5 de dezembro de 2026');
    expect(crossing).toBeVisible();
    expect(periodsRequested(fetchMock).at(-1)).toEqual({
      from: '2026-11-29',
      to: '2026-12-05',
    });
    await events.click(screen.getByRole('button', { name: 'Semana anterior' }));
    await events.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(periodsRequested(fetchMock).at(-1)).toEqual({
      from: '2026-11-08',
      to: '2026-11-14',
    });
  });

  it('mostra a reunião como um bloco com o horário, a outra parte e a situação, e abre o mesmo modal', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:7', 'week');
    const { events } = setup(
      [
        makeMeeting(1, {
          scheduled_at: '2026-11-11T09:00:00-03:00',
          ends_at: '2026-11-11T11:00:00-03:00',
          description: 'Revisar o capítulo 2',
        }),
      ],
      'student',
    );

    const block = await screen.findByRole('button', { name: /capítulo 2/ });

    expect(within(block).getByText('09:00–11:00')).toBeVisible();
    expect(within(block).getByText('Carlos Lima')).toBeVisible();
    expect(within(block).getByText('Pendente')).toBeVisible();
    await events.click(block);
    const dialog = await screen.findByRole('dialog', { name: 'Reunião' });
    expect(
      within(dialog).getByText('11 de novembro de 2026, das 09:00 às 11:00'),
    ).toBeVisible();
  });

  it('um bloco de uma hora também usa a linha única, para a situação não ser cortada', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:7', 'day');
    setup(
      [
        makeMeeting(1, {
          scheduled_at: '2026-11-10T10:00:00-03:00',
          ends_at: '2026-11-10T11:00:00-03:00',
          description: 'Uma hora',
        }),
      ],
      'student',
    );

    const block = await screen.findByRole('button', { name: /Uma hora/ });

    expect(within(block).queryByText('Pendente')).not.toBeInTheDocument();
    expect(within(block).getByTitle('Pendente')).toBeInTheDocument();
  });

  it('o bloco curto cabe numa linha, com o horário, a outra parte e o ícone da situação', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:7', 'day');
    setup(
      [
        makeMeeting(1, {
          scheduled_at: '2026-11-10T14:00:00-03:00',
          ends_at: '2026-11-10T14:30:00-03:00',
          description: 'Rápida',
          situation: 'accepted',
        }),
      ],
      'student',
    );

    const block = await screen.findByRole('button', { name: /Rápida/ });

    expect(within(block).getByText('14:00')).toBeVisible();
    expect(within(block).getByText('Carlos Lima')).toBeVisible();
    expect(within(block).queryByText('Aceita')).not.toBeInTheDocument();
    expect(
      within(block).getByTitle('Aceita').querySelector('svg'),
    ).not.toBeNull();
    expect(block).toHaveAccessibleName(/Aceita: Rápida/);
  });

  it('reuniões que se sobrepõem aparecem todas, cada uma com o seu bloco', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:7', 'day');
    setup(
      [
        makeMeeting(1, {
          scheduled_at: '2026-11-10T10:00:00-03:00',
          ends_at: '2026-11-10T11:30:00-03:00',
          description: 'Primeira',
        }),
        makeMeeting(2, {
          scheduled_at: '2026-11-10T10:30:00-03:00',
          ends_at: '2026-11-10T12:00:00-03:00',
          description: 'Segunda',
        }),
        makeMeeting(3, {
          scheduled_at: '2026-11-10T10:00:00-03:00',
          ends_at: '2026-11-10T11:00:00-03:00',
          description: 'Terceira',
        }),
      ],
      'student',
    );

    await screen.findByRole('button', { name: /Primeira/ });

    expect(screen.getByRole('button', { name: /Segunda/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Terceira/ })).toBeVisible();
  });

  it('funciona em tela pequena', async () => {
    setViewportWidth(PHONE_WIDTH);
    window.localStorage.setItem('sigtcc:reunioes:visao:7', 'day');
    const { events } = setup(
      [
        makeMeeting(1, {
          scheduled_at: '2026-11-10T09:00:00-03:00',
          ends_at: '2026-11-10T10:00:00-03:00',
          description: 'No celular',
        }),
      ],
      'student',
    );

    const block = await screen.findByRole('button', { name: /No celular/ });
    await events.click(block);

    expect(
      await screen.findByRole('dialog', { name: 'Reunião' }),
    ).toBeVisible();
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

describe('MeetingsPage: o botão Solicitar reunião da barra', () => {
  it('abre o formulário vazio e é acessível por teclado, com nome acessível', async () => {
    const { events } = setup([], 'student');
    const request = await screen.findByRole('button', {
      name: 'Solicitar reunião',
    });

    request.focus();
    await events.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog', {
      name: 'Solicitar reunião',
    });
    expect(within(dialog).getByLabelText(/Data/)).toHaveValue('');
    expect(within(dialog).getByLabelText(/Hora de início/)).toHaveValue('');
    expect(within(dialog).getByLabelText(/Hora de término/)).toHaveValue('');
  });

  it('está na barra do calendário, junto do seletor de visão', async () => {
    setup([], 'teacher');
    const request = await screen.findByRole('button', {
      name: 'Solicitar reunião',
    });

    expect(request.closest('h1')).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Visão do calendário' }).parentElement,
    ).toContainElement(request);
  });
});

describe('MeetingsPage: a visão salva', () => {
  it('abre no Mês sem preferência, com o seletor oferecendo as três visões', async () => {
    setup([], 'student');
    await screen.findByRole('heading', { level: 2, name: 'Novembro de 2026' });

    expect(screen.getByRole('button', { name: 'Mês' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const name of ['Dia', 'Semana', 'Mês']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
  });

  it('guarda a visão no navegador, separada por usuário, sem pedir nada', async () => {
    const { events } = setup([], 'student');
    await screen.findByRole('heading', { level: 2, name: 'Novembro de 2026' });

    await events.click(screen.getByRole('button', { name: 'Semana' }));

    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(window.localStorage.getItem('sigtcc:reunioes:visao:7')).toBe('week');
    expect(window.localStorage.getItem('sigtcc:reunioes:visao:9')).toBeNull();
  });

  it('abre na visão salva do próprio usuário e ignora a de outro', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:7', 'day');
    window.localStorage.setItem('sigtcc:reunioes:visao:9', 'week');
    setup([], 'student');

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Terça-feira, 10 de novembro de 2026',
      }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Dia' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('uma preferência salva que não é uma visão conhecida volta ao Mês', async () => {
    window.localStorage.setItem('sigtcc:reunioes:visao:7', 'ano');
    setup([], 'student');

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Novembro de 2026',
      }),
    ).toBeVisible();
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

  it('sem orientação ativa mas com histórico o calendário é só de leitura, com o botão desabilitado e o motivo explicado (RN29)', async () => {
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

    const request = screen.getByRole('button', { name: 'Solicitar reunião' });
    expect(request).toBeDisabled();
    const reason = screen.getByText(
      'Você precisa ter uma orientação ativa para solicitar reuniões.',
    );
    expect(reason).toBeVisible();
    expect(request).toHaveAccessibleDescription(reason.textContent ?? '');
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
