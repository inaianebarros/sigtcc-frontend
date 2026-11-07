import {
  Card,
  CardActions,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatDate } from '../formatters/dateTime';
import type { Advisee } from '../services/adviseeService';

const COUNT_LABELS: readonly {
  key: keyof Advisee['activities'];
  label: string;
}[] = [
  { key: 'pending', label: 'Pendente' },
  { key: 'inProgress', label: 'Em andamento' },
  { key: 'inReview', label: 'Em revisão' },
  { key: 'completed', label: 'Concluída' },
];

interface AdviseeCardProps {
  advisee: Advisee;
  /** Ponto de encaixe do link para o perfil do aluno (#31): envolve o nome, que é texto simples. */
  wrapName?: (name: string, advisee: Advisee) => ReactNode;
  /** Ponto de encaixe das ações do cartão, como encerrar a orientação (#33). */
  actions?: ReactNode;
}

/** O cartão de um orientando ativo: curso, início, tema e as atividades por status. */
export function AdviseeCard({ advisee, wrapName, actions }: AdviseeCardProps) {
  const titleId = useId();
  const { student } = advisee;
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography id={titleId} variant="h6" component="h2">
            {wrapName ? wrapName(student.fullName, advisee) : student.fullName}
          </Typography>
          <Typography color="text.secondary">{student.course.name}</Typography>
          <Typography color="text.secondary">
            Orientação iniciada em {formatDate(advisee.startedAt)}
          </Typography>
          <Typography>
            {advisee.thesisTopic
              ? `Tema: ${advisee.thesisTopic}`
              : 'Tema não cadastrado'}
          </Typography>
          <Stack
            component="ul"
            aria-label="Atividades por status"
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap', gap: 2, m: 0, p: 0, listStyle: 'none' }}
          >
            {COUNT_LABELS.map(({ key, label }) => (
              <Typography component="li" key={key}>
                {`${label}: ${advisee.activities[key]}`}
              </Typography>
            ))}
          </Stack>
        </Stack>
      </CardContent>
      {actions && <CardActions sx={{ px: 2, pb: 2 }}>{actions}</CardActions>}
    </Card>
  );
}
