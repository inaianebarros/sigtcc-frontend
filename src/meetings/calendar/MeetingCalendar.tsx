import FullCalendar from '@fullcalendar/react';
import type { CalendarController, EventInput } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import ptBrLocale from '@fullcalendar/react/locales/pt-br';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import { ButtonBase, Stack, Typography } from '@mui/material';
import { useEffect, useMemo } from 'react';
import type { MeetingItem } from '../../services/meetingService';
import { SituationChip } from '../SituationChip';
import { SITUATIONS } from '../situationDisplay';
import { dateOf, dayBefore, dayTitle, weekTitle } from './periodDates';
import type { CalendarView } from './viewPreference';
import './calendar.css';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';

/** A hora do dia (HH:MM) de um instante ISO com fuso, como foi escrita no próprio texto. */
function clock(iso: string): string {
  return iso.slice(11, 16);
}

export interface CalendarPeriod {
  /** O primeiro dia exibido (AAAA-MM-DD, inclusive). */
  from: string;
  /** O último dia exibido (AAAA-MM-DD, inclusive). */
  to: string;
  /** O título do período: "novembro de 2026", "8 – 14 de novembro de 2026" ou o dia por extenso. */
  title: string;
}

const MAX_CARDS_PER_DAY = 3;

const FULL_CALENDAR_VIEWS: Record<CalendarView, string> = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
};

// Até 90 minutos (três faixas de 30) o bloco não comporta as três linhas do cartão completo.
const SHORT_MEETING_MINUTES = 90;

/** A duração de uma reunião em minutos, a partir dos dois instantes ISO. */
function minutesBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000;
}

/** A cor da faixa lateral do cartão, por situação; a situação também está no texto e no ícone. */
function stripeColor(item: MeetingItem): string {
  const { color } = SITUATIONS[item.situation];
  return color === 'default' ? 'text.secondary' : `${color}.main`;
}

interface MeetingCalendarProps {
  controller: CalendarController;
  view: CalendarView;
  meetings: MeetingItem[];
  onPeriod: (period: CalendarPeriod) => void;
  onOpen: (item: MeetingItem) => void;
  /** O "+N mais" do Mês leva à visão Dia daquele dia: quem usa acompanha a mudança de visão. */
  onMoreLink: () => void;
  /** O clique num dia ou numa faixa de horário (RF60), com o texto do instante; sem ele o clique não faz nada. */
  onSlotClick?: (dateStr: string) => void;
}

/**
 * O calendário de reuniões (RF19, ADR frontend 0004): a grade do FullCalendar, em português, com
 * a semana começando no domingo e os horários no fuso de Santarém. Cada reunião é um cartão que
 * é um botão de verdade, com o horário, a outra parte e a situação (texto e ícone, não só cor), e
 * abre o modal da reunião. No Mês cada dia mostra até 3 cartões e o "+N mais" leva à visão Dia; no Dia e na Semana o cartão ocupa o intervalo real da reunião.
 */
export function MeetingCalendar({
  controller,
  view,
  meetings,
  onPeriod,
  onOpen,
  onMoreLink,
  onSlotClick,
}: MeetingCalendarProps) {
  // A visão muda por fora (o seletor): o calendário só a troca se ainda não estiver nela.
  useEffect(() => {
    if (controller.view && controller.view.type !== FULL_CALENDAR_VIEWS[view]) {
      controller.changeView(FULL_CALENDAR_VIEWS[view]);
    }
  }, [controller, view]);
  const events = useMemo<EventInput[]>(
    () =>
      meetings.map((item) => ({
        id: String(item.id),
        start: item.scheduledAt,
        end: item.endsAt,
        extendedProps: { item },
      })),
    [meetings],
  );
  return (
    <FullCalendar
      plugins={[
        dayGridPlugin,
        timeGridPlugin,
        interactionPlugin,
        classicThemePlugin,
      ]}
      controller={controller}
      locale={ptBrLocale}
      timeZone="America/Santarem"
      firstDay={0}
      initialView={FULL_CALENDAR_VIEWS[view]}
      headerToolbar={false}
      dayMaxEvents={MAX_CARDS_PER_DAY}
      moreLinkText={(hidden) => `+${hidden} mais`}
      moreLinkClick={() => {
        onMoreLink();
        return 'timeGridDay';
      }}
      dateClick={(info) => onSlotClick?.(info.dateStr)}
      // O eixo de 24 horas abre rolado às 07:00, em faixas de 30 minutos, e as reuniões que se
      // sobrepõem ficam lado a lado, sem esconder nenhuma.
      scrollTime="07:00:00"
      slotDuration="00:30:00"
      allDaySlot={false}
      slotEventOverlap={false}
      nowIndicator
      events={events}
      eventContent={({ event }) => {
        const item = event.extendedProps.item as MeetingItem;
        const timed = view !== 'month';
        const short =
          timed &&
          minutesBetween(item.scheduledAt, item.endsAt) < SHORT_MEETING_MINUTES;
        const { icon, label } = SITUATIONS[item.situation];
        return (
          <ButtonBase
            onClick={() => onOpen(item)}
            aria-label={`${clock(item.scheduledAt)} às ${clock(item.endsAt)}, ${item.counterpart.fullName}, ${label}: ${item.description}`}
            sx={{
              display: 'block',
              width: '100%',
              height: timed ? '100%' : undefined,
              minWidth: 0,
              overflow: 'hidden',
              textAlign: 'left',
              p: 0.5,
              borderRadius: 1,
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: 1,
              borderColor: 'divider',
              borderLeft: 4,
              borderLeftColor: stripeColor(item),
            }}
          >
            {short ? (
              // O bloco curto cabe numa linha: horário, a outra parte e o ícone da situação.
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'center', minWidth: 0 }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {clock(item.scheduledAt)}
                </Typography>
                <Typography variant="caption" noWrap sx={{ flexGrow: 1 }}>
                  {item.counterpart.fullName}
                </Typography>
                <span title={label} style={{ display: 'inline-flex' }}>
                  {icon}
                </span>
              </Stack>
            ) : (
              <Stack spacing={0.25}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {clock(item.scheduledAt)}–{clock(item.endsAt)}
                </Typography>
                <Typography variant="caption" noWrap>
                  {item.counterpart.fullName}
                </Typography>
                <SituationChip situation={item.situation} />
              </Stack>
            )}
          </ButtonBase>
        );
      }}
      datesSet={(info) => {
        const from = dateOf(info.startStr);
        const to = dayBefore(dateOf(info.endStr));
        onPeriod({
          from,
          to,
          title:
            info.view.type === FULL_CALENDAR_VIEWS.day
              ? dayTitle(from)
              : info.view.type === FULL_CALENDAR_VIEWS.week
                ? weekTitle(from, to)
                : info.view.title,
        });
      }}
    />
  );
}
