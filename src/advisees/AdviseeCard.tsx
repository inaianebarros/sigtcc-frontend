import {
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatShortDate } from '../formatters/dateTime';
import type { Advisee } from '../services/adviseeService';

type ChipColor = 'default' | 'primary' | 'secondary' | 'success';

const COUNT_LABELS: readonly {
  key: keyof Advisee['activities'];
  label: string;
  color: ChipColor;
}[] = [
  { key: 'pending', label: 'Pendentes', color: 'default' },
  { key: 'inProgress', label: 'Em andamento', color: 'primary' },
  { key: 'inReview', label: 'Em revisão', color: 'secondary' },
  { key: 'completed', label: 'Concluídas', color: 'success' },
];

interface AdviseeCardProps {
  advisee: Advisee;
  /** Ponto de encaixe do link para o perfil do aluno (#31): envolve o nome, que é texto simples. */
  wrapName?: (name: string, advisee: Advisee) => ReactNode;
  /** Ponto de encaixe do menu "⋯" do cartão, como o de encerrar a orientação (#33). */
  menu?: ReactNode;
  /** Ponto de encaixe das ações do dia a dia do cartão, como ver atividades e editar o tema. */
  actions?: ReactNode;
}

/**
 * O cartão de um orientando ativo: o nome, a situação, o curso, o início, o tema e as atividades
 * por situação em chips, inclusive com zero.
 */
export function AdviseeCard({
  advisee,
  wrapName,
  menu,
  actions,
}: AdviseeCardProps) {
  const titleId = useId();
  const { student } = advisee;
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography
              id={titleId}
              variant="h6"
              component="h2"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {wrapName
                ? wrapName(student.fullName, advisee)
                : student.fullName}
            </Typography>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
              <Chip
                label="Ativa"
                color="success"
                size="small"
                variant="outlined"
              />
              {menu}
            </Stack>
          </Stack>
          <Typography color="text.secondary">{student.course.name}</Typography>
          <Typography color="text.secondary">
            Início da orientação: {formatShortDate(advisee.startedAt)}
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {advisee.thesisTopic
              ? `Tema: ${advisee.thesisTopic}`
              : 'Tema não cadastrado'}
          </Typography>
          <Stack
            component="ul"
            aria-label="Atividades por status"
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap', gap: 1, m: 0, p: 0, listStyle: 'none' }}
          >
            {COUNT_LABELS.map(({ key, label, color }) => (
              <li key={key}>
                <Chip
                  label={`${label}: ${advisee.activities[key]}`}
                  color={color}
                  size="small"
                  variant="outlined"
                />
              </li>
            ))}
          </Stack>
        </Stack>
      </CardContent>
      {actions && <CardActions sx={{ px: 2, pb: 2 }}>{actions}</CardActions>}
    </Card>
  );
}
