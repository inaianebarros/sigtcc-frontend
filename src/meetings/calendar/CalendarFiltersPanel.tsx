import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { Theme } from '@mui/material';
import { useState } from 'react';
import { PagePagination } from '../../components/PagePagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useLoad } from '../../hooks/useLoad';
import type { LoadState } from '../../hooks/useLoad';
import {
  CALENDAR_ADVISEES_PAGE_SIZE,
  listCalendarAdvisees,
  MEETING_SITUATIONS,
} from '../../services/meetingService';
import type {
  CalendarAdviseePage,
  MeetingSituation,
} from '../../services/meetingService';
import { SITUATIONS } from '../situationDisplay';

const SEARCH_PAUSE_MS = 400;

interface CalendarFiltersPanelProps {
  /** Só o professor filtra por orientandos; o aluno tem reuniões só com o orientador (RF59). */
  isTeacher: boolean;
  /** As situações ligadas; todas começam ligadas e nada é salvo (RN46). */
  situations: ReadonlySet<MeetingSituation>;
  onSituation: (situation: MeetingSituation, on: boolean) => void;
  /** Os orientandos desmarcados: assim um orientando novo já nasce marcado (RF59). */
  hiddenStudentIds: ReadonlySet<number>;
  onStudent: (id: number, on: boolean) => void;
  onShowAllStudents: () => void;
}

function SituationSection({
  situations,
  onSituation,
}: Pick<CalendarFiltersPanelProps, 'situations' | 'onSituation'>) {
  return (
    <FormControl component="fieldset" variant="standard">
      <FormLabel component="legend">Situação</FormLabel>
      <FormGroup>
        {MEETING_SITUATIONS.map((situation) => (
          <FormControlLabel
            key={situation}
            label={SITUATIONS[situation].label}
            control={
              <Checkbox
                checked={situations.has(situation)}
                onChange={(event) =>
                  onSituation(situation, event.target.checked)
                }
              />
            }
          />
        ))}
      </FormGroup>
    </FormControl>
  );
}

function AdviseeSection({
  hiddenStudentIds,
  onStudent,
  onShowAllStudents,
}: Pick<
  CalendarFiltersPanelProps,
  'hiddenStudentIds' | 'onStudent' | 'onShowAllStudents'
>) {
  const [typed, setTyped] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(typed.trim(), SEARCH_PAUSE_MS);
  const list = useLoad(
    () => listCalendarAdvisees(page, search),
    `${page}|${search}`,
  );
  const [last, setLast] = useState<LoadState<CalendarAdviseePage>>({
    status: 'idle',
  });
  // Enquanto a próxima leitura chega, a lista anterior continua na tela.
  const shown = list.status === 'ready' ? list : last;
  if (list.status === 'ready' && last !== list) setLast(list);
  const total = shown.status === 'ready' ? shown.data.count : 0;
  const lastPage = Math.max(1, Math.ceil(total / CALENDAR_ADVISEES_PAGE_SIZE));
  return (
    <FormControl component="fieldset" variant="standard">
      <FormLabel component="legend">Orientandos</FormLabel>
      <Stack spacing={1}>
        <TextField
          size="small"
          label="Buscar orientando"
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            setPage(1);
          }}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        {list.status === 'error' && (
          <Alert severity="error">{list.message}</Alert>
        )}
        {shown.status !== 'ready' && list.status !== 'error' && (
          <Typography variant="body2" color="text.secondary">
            Carregando orientandos…
          </Typography>
        )}
        {shown.status === 'ready' && shown.data.items.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Nenhum orientando encontrado.
          </Typography>
        )}
        {shown.status === 'ready' && (
          <FormGroup>
            {shown.data.items.map((advisee) => (
              <FormControlLabel
                key={advisee.id}
                control={
                  <Checkbox
                    checked={!hiddenStudentIds.has(advisee.id)}
                    onChange={(event) =>
                      onStudent(advisee.id, event.target.checked)
                    }
                  />
                }
                label={
                  <Stack>
                    <span>{advisee.fullName}</span>
                    {advisee.ended && (
                      <Typography variant="caption" color="text.secondary">
                        Orientação encerrada
                      </Typography>
                    )}
                  </Stack>
                }
              />
            ))}
          </FormGroup>
        )}
        <PagePagination
          ariaLabel="Paginação dos orientandos"
          knownCount={total}
          pageSize={CALENDAR_ADVISEES_PAGE_SIZE}
          lastPage={lastPage}
          page={page}
          onChange={setPage}
        />
        {hiddenStudentIds.size > 0 && (
          <Button size="small" onClick={onShowAllStudents}>
            Marcar todos os orientandos
          </Button>
        )}
      </Stack>
    </FormControl>
  );
}

/**
 * O painel de filtros do calendário de reuniões (RF59): "Situação" para os dois perfis e
 * "Orientandos", com busca e paginação no servidor, só para o professor. Em tela pequena vira uma
 * seção recolhível acima do calendário (RNF24), fechada ao abrir.
 */
export function CalendarFiltersPanel(props: CalendarFiltersPanelProps) {
  const isNarrow = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down('md'),
  );
  const content = (
    <Stack spacing={2}>
      <SituationSection
        situations={props.situations}
        onSituation={props.onSituation}
      />
      {props.isTeacher && (
        <AdviseeSection
          hiddenStudentIds={props.hiddenStudentIds}
          onStudent={props.onStudent}
          onShowAllStudents={props.onShowAllStudents}
        />
      )}
    </Stack>
  );
  if (isNarrow) {
    return (
      <Accordion disableGutters variant="outlined">
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="calendar-filters"
          id="calendar-filters-header"
        >
          <Typography component="h2" variant="subtitle1">
            Filtros
          </Typography>
        </AccordionSummary>
        <AccordionDetails id="calendar-filters">{content}</AccordionDetails>
      </Accordion>
    );
  }
  return (
    <Paper
      component="aside"
      variant="outlined"
      aria-label="Filtros do calendário"
      sx={{ p: 2, width: 280, flexShrink: 0, alignSelf: 'flex-start' }}
    >
      <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
        Filtros
      </Typography>
      {content}
    </Paper>
  );
}
