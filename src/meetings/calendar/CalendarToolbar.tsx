import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Button,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import { AVAILABLE_VIEWS } from './viewPreference';
import type { CalendarView } from './viewPreference';

const ARROW_LABELS: Record<CalendarView, { previous: string; next: string }> = {
  day: { previous: 'Dia anterior', next: 'Próximo dia' },
  week: { previous: 'Semana anterior', next: 'Próxima semana' },
  month: { previous: 'Mês anterior', next: 'Próximo mês' },
};

const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
};

interface CalendarToolbarProps {
  title: string;
  view: CalendarView;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onView: (view: CalendarView) => void;
  onRequest: () => void;
  /** Por que a solicitação está desabilitada (RN29); sem motivo, o botão está habilitado. */
  requestDisabledReason: string | null;
}

/**
 * A barra do calendário de reuniões (RF19): Hoje, as setas, o título do período e o seletor de
 * visão. Fica em MUI, fora do FullCalendar, e só tem o que a tela usa. O título está numa região
 * que anuncia a mudança de período ao leitor de tela.
 */
export function CalendarToolbar({
  title,
  view,
  onToday,
  onPrevious,
  onNext,
  onView,
  onRequest,
  requestDisabledReason,
}: CalendarToolbarProps) {
  const reasonId = useId();
  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button variant="outlined" onClick={onToday}>
            Hoje
          </Button>
          <IconButton
            aria-label={ARROW_LABELS[view].previous}
            onClick={onPrevious}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton aria-label={ARROW_LABELS[view].next} onClick={onNext}>
            <ChevronRightIcon />
          </IconButton>
          <Typography variant="h6" component="h2">
            <span role="status" aria-live="polite">
              {title}
            </span>
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            aria-label="Visão do calendário"
            onChange={(_event, next: CalendarView | null) => {
              if (next !== null) onView(next);
            }}
          >
            {(Object.keys(VIEW_LABELS) as CalendarView[]).map((option) => (
              <ToggleButton
                key={option}
                value={option}
                disabled={!AVAILABLE_VIEWS.includes(option)}
              >
                {VIEW_LABELS[option]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button
            variant="contained"
            onClick={onRequest}
            disabled={requestDisabledReason !== null}
            aria-describedby={requestDisabledReason ? reasonId : undefined}
          >
            Solicitar reunião
          </Button>
        </Stack>
      </Stack>
      {requestDisabledReason && (
        <Typography id={reasonId} variant="body2" color="text.secondary">
          {requestDisabledReason}
        </Typography>
      )}
    </Stack>
  );
}
