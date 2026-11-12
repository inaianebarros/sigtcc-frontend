import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { makeMeeting, meetingsServer } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/reunioes';
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

function rowOf(text: string | RegExp) {
  return screen.getByRole('row', { name: text });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('MeetingsPage: a lista', () => {
  it('mostra a data e a hora em Santarém, com quem, a descrição, a situação e quem solicitou', async () => {
    setup(
      [
        makeMeeting(1, {
          scheduled_at: '2099-12-31T14:30:00-03:00',
          description: 'Revisar o capítulo 2',
          counterpart: { id: 9, full_name: 'Carlos Lima' },
        }),
      ],
      'student',
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reuniões' }),
    ).toBeVisible();
    await screen.findByText('Revisar o capítulo 2');

    const row = rowOf(/Revisar o capítulo 2/);
    expect(
      within(row).getByText('31 de dezembro de 2099, das 14:30 às 15:30'),
    ).toBeVisible();
    expect(within(row).getByText('Carlos Lima')).toBeVisible();
    expect(within(row).getByText('Pendente')).toBeVisible();
    expect(within(row).getByText('Você')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Com' })).toBeVisible();
  });

  it('mostra o nome da outra parte quando foi ela quem solicitou', async () => {
    setup(
      [
        makeMeeting(1, {
          author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
          counterpart: { id: 9, full_name: 'Carlos Lima' },
        }),
      ],
      'student',
    );

    await screen.findByText('Reunião 1 de orientação');

    const row = rowOf(/Reunião 1 de orientação/);
    expect(within(row).queryByText('Você')).not.toBeInTheDocument();
    // O nome aparece em "Com" e em "Solicitada por".
    expect(within(row).getAllByText('Carlos Lima')).toHaveLength(2);
  });

  it('mostra a lista do professor com o aluno na coluna Com e o botão de solicitar', async () => {
    setup(
      [
        makeMeeting(1, {
          author: { id: 9, full_name: 'Carlos Lima', type: 'teacher' },
          counterpart: { id: 101, full_name: 'Maria Lima' },
        }),
      ],
      'teacher',
    );

    await screen.findByText('Reunião 1 de orientação');

    const row = rowOf(/Reunião 1 de orientação/);
    expect(within(row).getByText('Maria Lima')).toBeVisible();
    expect(within(row).getByText('Você')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Solicitar reunião' }),
    ).toBeVisible();
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
      setup(
        [makeMeeting(1, { situation, description: 'Pauta única' })],
        'student',
      );

      await screen.findByText('Pauta única');

      const chip = within(rowOf(/Pauta única/)).getByText(label);
      expect(chip).toBeVisible();
      expect(
        chip.closest('.MuiChip-root')?.querySelector('svg'),
      ).not.toBeNull();
    },
  );

  it('mostra o motivo da recusa e o motivo do cancelamento', async () => {
    setup(
      [
        makeMeeting(1, {
          situation: 'rejected',
          status: 'rejected',
          rejection_reason: 'Estarei em viagem.',
          description: 'Pauta da reunião recusada',
        }),
        makeMeeting(2, {
          situation: 'cancelled',
          status: 'cancelled',
          cancellation_reason: 'Tive um imprevisto.',
          description: 'Pauta da reunião cancelada',
        }),
      ],
      'student',
    );

    await screen.findByText('Pauta da reunião recusada');

    expect(
      within(rowOf(/Pauta da reunião recusada/)).getByText(
        /Motivo da recusa: Estarei em viagem\./,
      ),
    ).toBeVisible();
    expect(
      within(rowOf(/Pauta da reunião cancelada/)).getByText(
        /Motivo do cancelamento: Tive um imprevisto\./,
      ),
    ).toBeVisible();
  });

  it('indica o cancelamento feito pelo sistema a partir da marcação, não do texto', async () => {
    setup(
      [
        makeMeeting(1, {
          situation: 'cancelled',
          status: 'cancelled',
          cancelled_by_system: true,
          cancellation_reason:
            'Esta reunião foi cancelada automaticamente pelo sistema porque a orientação foi encerrada.',
          description: 'Do sistema',
        }),
        makeMeeting(2, {
          situation: 'cancelled',
          status: 'cancelled',
          cancelled_by_system: false,
          cancellation_reason:
            'Esta reunião foi cancelada automaticamente pelo sistema porque a orientação foi encerrada.',
          description: 'Texto igual, mas pelo autor',
        }),
      ],
      'student',
    );

    await screen.findByText('Do sistema');

    expect(
      within(rowOf(/Do sistema/)).getByText('Cancelada pelo sistema'),
    ).toBeVisible();
    expect(
      within(rowOf(/Texto igual, mas pelo autor/)).queryByText(
        'Cancelada pelo sistema',
      ),
    ).not.toBeInTheDocument();
  });

  it('corta a descrição com reticências por CSS e deixa o texto inteiro para o leitor de tela e para o tooltip', async () => {
    const long = 'Pauta muito longa '.repeat(20).trim();
    const { events } = setup(
      [makeMeeting(1, { description: long })],
      'student',
    );

    const text = await screen.findByText(long);

    expect(text).toHaveStyle({
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    expect(text).toHaveAccessibleName(long);
    await events.hover(text);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(long);
  });
});

describe('MeetingsPage: estados', () => {
  it('sem reuniões mostra o estado vazio, com o botão de solicitar', async () => {
    setup([], 'student');

    expect(
      await screen.findByText('Você ainda não tem reuniões.'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Solicitar reunião' }),
    ).toBeVisible();
  });

  it('sem orientação ativa mas com histórico a lista é só de leitura, sem o botão de solicitar', async () => {
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

    await screen.findByText('Histórico');

    expect(
      screen.queryByRole('button', { name: 'Solicitar reunião' }),
    ).not.toBeInTheDocument();
  });

  it('mostra o esqueleto enquanto carrega e oferece Tentar novamente quando falha', async () => {
    const server = meetingsServer([makeMeeting(1)], { user: 'student' });
    let failing = true;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = server.routes[LIST]!;
    server.routes[LIST] = async (body, url, params) => {
      await gate;
      if (failing) return { status: 500, body: {} };
      return typeof original === 'function'
        ? original(body, url, params)
        : original;
    };
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(STUDENT_PATH);

    expect(await screen.findByTestId('meetings-skeleton')).toBeVisible();
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    failing = false;
    await events.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Reunião 1 de orientação')).toBeVisible();
  });

  it('no celular mostra cartões, com a etiqueta e os motivos, em vez da tabela', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup(
      [
        makeMeeting(1, {
          situation: 'rejected',
          status: 'rejected',
          rejection_reason: 'Sem horário.',
          description: 'No celular',
        }),
      ],
      'student',
    );

    const card = await screen.findByRole('article', { name: /No celular/ });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(card).getByText('Recusada')).toBeVisible();
    expect(
      within(card).getByText(/Motivo da recusa: Sem horário\./),
    ).toBeVisible();
    expect(within(card).getByText('Com: Carlos Lima')).toBeVisible();
    // No cartão há espaço: a descrição quebra a linha, sem corte.
    expect(within(card).getByText('No celular')).not.toHaveStyle({
      textOverflow: 'ellipsis',
    });
  });

  it('pede a primeira página de 20 e pagina com a página na URL', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      makeMeeting(index + 1, { description: `Reunião número ${index + 1}` }),
    );
    const { fetchMock, events } = setup(many, 'student');
    await screen.findByText('Reunião número 1');
    const first = new URL(
      String(requestsTo(fetchMock, LIST).at(-1)![0]),
      'http://localhost',
    );
    expect(first.searchParams.get('limit')).toBe('20');

    await events.click(
      screen.getByRole('button', { name: /Ir para a página 2/ }),
    );

    await screen.findByText('Reunião número 21');
    expect(screen.getByTestId('location')).toHaveTextContent('pagina=2');
  });
});
