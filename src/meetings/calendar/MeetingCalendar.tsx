import FullCalendar from '@fullcalendar/react';
import type { CalendarController, EventInput } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import ptBrLocale from '@fullcalendar/react/locales/pt-br';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import { ButtonBase, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import type { MeetingItem } from '../../services/meetingService';
import { SituationChip } from '../SituationChip';
import { SITUATIONS } from '../situationDisplay';
import { dateOf, dayBefore } from './periodDates';
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
  /** O título do período, como "novembro de 2026". */
  title: string;
}

const MAX_CARDS_PER_DAY = 3;

const FULL_CALENDAR_VIEWS: Record<CalendarView, string> = {
  day: 'dayGridDay',
  week: 'dayGridWeek',
  month: 'dayGridMonth',
};

interface MeetingCalendarProps {
  controller: CalendarController;
  view: CalendarView;
  meetings: MeetingItem[];
  onPeriod: (period: CalendarPeriod) => void;
  onOpen: (item: MeetingItem) => void;
}

/**
 * O calendário de reuniões (RF19, ADR frontend 0004): a grade do FullCalendar, em português, com
 * a semana começando no domingo e os horários no fuso de Santarém. Cada reunião é um cartão que
 * é um botão de verdade, com o horário, a outra parte e a situação (texto e ícone, não só cor), e
 * abre o modal da reunião. Cada dia mostra até 3 cartões e indica o excedente.
 */
export function MeetingCalendar({
  controller,
  view,
  meetings,
  onPeriod,
  onOpen,
}: MeetingCalendarProps) {
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
      plugins={[dayGridPlugin, classicThemePlugin]}
      controller={controller}
      locale={ptBrLocale}
      timeZone="America/Santarem"
      firstDay={0}
      initialView={FULL_CALENDAR_VIEWS[view]}
      headerToolbar={false}
      dayMaxEvents={MAX_CARDS_PER_DAY}
      moreLinkText={(hidden) => `+${hidden} mais`}
      events={events}
      eventContent={({ event }) => {
        const item = event.extendedProps.item as MeetingItem;
        return (
          <ButtonBase
            onClick={() => onOpen(item)}
            aria-label={`${clock(item.scheduledAt)} às ${clock(item.endsAt)}, ${item.counterpart.fullName}, ${SITUATIONS[item.situation].label}: ${item.description}`}
            sx={{
              display: 'block',
              width: '100%',
              minWidth: 0,
              overflow: 'hidden',
              textAlign: 'left',
              p: 0.5,
              borderRadius: 1,
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack spacing={0.25}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {clock(item.scheduledAt)}–{clock(item.endsAt)}
              </Typography>
              <Typography variant="caption" noWrap>
                {item.counterpart.fullName}
              </Typography>
              <SituationChip situation={item.situation} />
            </Stack>
          </ButtonBase>
        );
      }}
      datesSet={(info) =>
        onPeriod({
          from: dateOf(info.startStr),
          to: dayBefore(dateOf(info.endStr)),
          title: info.view.title,
        })
      }
    />
  );
}
