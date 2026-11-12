import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { setupCalendarTest, teardownCalendarTest } from '../test/calendarClock';
import { tokenStore } from '../services/tokenStore';
import { meetingsServer } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

// O jsdom não mede o layout, então o clique por posição do FullCalendar não funciona nele. O
// calendário é trocado por um que só entrega à página o texto do instante clicado, como o dateClick
// faz; o resto, do clique ao formulário preenchido, é o código real da página. O clique por posição
// em si é verificação manual no navegador.
vi.mock('../meetings/calendar/MeetingCalendar', () => ({
  MeetingCalendar: ({
    onPeriod,
    onSlotClick,
  }: {
    onPeriod: (period: { from: string; to: string; title: string }) => void;
    onSlotClick?: (dateStr: string) => void;
  }) => {
    useEffect(() => {
      onPeriod({
        from: '2026-11-01',
        to: '2026-12-12',
        title: 'novembro de 2026',
      });
    }, [onPeriod]);
    return (
      <div>
        <p>{onSlotClick ? 'cliques ligados' : 'cliques desligados'}</p>
        {[
          ['dia futuro', '2026-11-20'],
          ['dia de hoje', '2026-11-10'],
          ['dia passado', '2026-11-03'],
          ['faixa futura', '2026-11-20T14:00:00-03:00'],
          ['faixa tardia', '2026-11-20T23:30:00-03:00'],
          ['faixa que já começou', '2026-11-10T11:30:00-03:00'],
        ].map(([label, dateStr]) => (
          <button key={label} onClick={() => onSlotClick?.(dateStr!)}>
            {label}
          </button>
        ))}
      </div>
    );
  },
}));

function setup(active = true) {
  const server = meetingsServer([], { user: 'student', active });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp('/aluno/reunioes');
  return { fetchMock, events };
}

const dialogOf = () =>
  screen.findByRole('dialog', { name: 'Solicitar reunião' });

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  setupCalendarTest();
});

afterEach(() => {
  teardownCalendarTest();
});

describe('MeetingsPage: solicitar pelo clique no calendário (RF60)', () => {
  it('um dia futuro abre o formulário com a data e o início e o término em branco', async () => {
    const { events } = setup();
    await events.click(
      await screen.findByRole('button', { name: 'dia futuro' }),
    );

    const dialog = await dialogOf();

    expect(within(dialog).getByLabelText(/Data/)).toHaveValue('2026-11-20');
    expect(within(dialog).getByLabelText(/Hora de início/)).toHaveValue('');
    expect(within(dialog).getByLabelText(/Hora de término/)).toHaveValue('');
  });

  it('o dia de hoje também abre o formulário', async () => {
    const { events } = setup();
    await events.click(
      await screen.findByRole('button', { name: 'dia de hoje' }),
    );

    expect(within(await dialogOf()).getByLabelText(/Data/)).toHaveValue(
      '2026-11-10',
    );
  });

  it('uma faixa futura preenche a data, o início e o término uma hora depois, editáveis', async () => {
    const { events } = setup();
    await events.click(
      await screen.findByRole('button', { name: 'faixa futura' }),
    );

    const dialog = await dialogOf();

    expect(within(dialog).getByLabelText(/Data/)).toHaveValue('2026-11-20');
    expect(within(dialog).getByLabelText(/Hora de início/)).toHaveValue(
      '14:00',
    );
    const end = within(dialog).getByLabelText(/Hora de término/);
    expect(end).toHaveValue('15:00');
    expect(end).toBeEnabled();
  });

  it('o término sugerido de uma faixa no fim do dia não passa da meia-noite', async () => {
    const { events } = setup();
    await events.click(
      await screen.findByRole('button', { name: 'faixa tardia' }),
    );

    const dialog = await dialogOf();

    expect(within(dialog).getByLabelText(/Hora de início/)).toHaveValue(
      '23:30',
    );
    expect(within(dialog).getByLabelText(/Hora de término/)).toHaveValue(
      '23:59',
    );
  });

  it.each(['dia passado', 'faixa que já começou'])(
    'o clique em %s não abre nada',
    async (label) => {
      const { events } = setup();

      await events.click(await screen.findByRole('button', { name: label }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

  it('o preenchimento não conta como alteração: fechar sem mexer não pede confirmação, e mexer pede', async () => {
    const { events } = setup();
    await events.click(
      await screen.findByRole('button', { name: 'faixa futura' }),
    );
    const dialog = await dialogOf();
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();

    await events.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await events.click(screen.getByRole('button', { name: 'faixa futura' }));
    const again = await dialogOf();
    await events.type(within(again).getByLabelText(/Descrição/), 'Pauta');
    expect(
      await within(again).findByText(/Você tem alterações não salvas/),
    ).toBeVisible();
  });

  it('envia a reunião com a data, o início e o término preenchidos pelo clique', async () => {
    const { fetchMock, events } = setup();
    await events.click(
      await screen.findByRole('button', { name: 'faixa futura' }),
    );
    const dialog = await dialogOf();
    await events.type(
      within(dialog).getByLabelText(/Descrição/),
      'Revisar o capítulo',
    );

    await events.click(
      within(dialog).getByRole('button', { name: 'Solicitar' }),
    );

    expect(await screen.findByText('Reunião solicitada.')).toBeVisible();
    const [, init] = requestsTo(fetchMock, 'POST /api/reunioes')[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      date: '2026-11-20',
      time: '14:00',
      end_time: '15:00',
      description: 'Revisar o capítulo',
    });
  });

  it('sem orientação ativa o clique fica desligado', async () => {
    setup(false);

    expect(await screen.findByText('cliques desligados')).toBeVisible();
  });

  it('com orientação ativa o clique fica ligado', async () => {
    setup(true);

    expect(await screen.findByText('cliques ligados')).toBeVisible();
  });
});
