import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { formatDeadlineShort } from '../formatters/dateTime';
import { originState } from '../navigation/origin';
import { activityPath } from '../navigation/paths';
import type { ActivityItem } from '../services/activityService';
import { StatusWithBadge } from './StatusWithBadge';

interface ActivityCardsProps {
  items: readonly ActivityItem[];
  /** O nome do aluno só aparece para o professor: as atividades do aluno são todas dele. */
  showStudent: boolean;
  userType: 'student' | 'teacher';
}

type OriginState = ReturnType<typeof originState>;

/**
 * Uma atividade como cartão: o título, o aluno (só para o professor), o prazo e a situação em
 * pílula, sem nome de campo. O cartão inteiro é o link para o detalhe e leva junto a lista de onde
 * veio, com a página e os filtros, para o "Voltar" do detalhe restaurá-los. A seta é só uma pista
 * de que o cartão é clicável.
 */
function ActivityCard({
  item,
  showStudent,
  userType,
  origin,
}: { item: ActivityItem; origin: OriginState } & Omit<
  ActivityCardsProps,
  'items'
>) {
  return (
    <Card variant="outlined">
      <CardActionArea
        component={RouterLink}
        to={activityPath(userType, item.id)}
        state={origin}
      >
        <CardContent>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                component="h2"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {item.title}
              </Typography>
              {showStudent && (
                <Typography color="text.secondary">
                  {item.student.fullName}
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                {/* O nome "Prazo" é só do leitor de tela: sem <title>, não aparece como dica nem como texto. */}
                <CalendarTodayIcon
                  fontSize="small"
                  role="img"
                  aria-hidden={false}
                  aria-label="Prazo"
                />
                <Typography component="time" dateTime={item.deadline}>
                  {formatDeadlineShort(item.deadline)}
                </Typography>
              </Stack>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexShrink: 0 }}
            >
              <StatusWithBadge
                pill
                status={item.status}
                overdue={item.overdue}
              />
              <ChevronRightIcon aria-hidden />
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

/** A lista de atividades em cartões, na ordem em que o servidor a devolve. */
export function ActivityCards({ items, ...rest }: ActivityCardsProps) {
  const origin = originState(useLocation());
  return (
    <Stack
      component="ul"
      aria-label="Atividades"
      spacing={2}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {items.map((item) => (
        <li key={item.id}>
          <ActivityCard item={item} origin={origin} {...rest} />
        </li>
      ))}
    </Stack>
  );
}
