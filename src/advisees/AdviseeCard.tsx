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
 * O cartão de um orientando ativo (a lista só tem orientações ativas): o nome, o curso, o início, o tema e as atividades
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
  // Quem espera a revisão do professor (RN21) vem no topo da lista e leva uma faixa teal fina.
  const waitsForReview = advisee.activities.inReview > 0;
  return (
    <Card
      component="article"
      aria-labelledby={titleId}
      variant="outlined"
      sx={
        waitsForReview
          ? { borderLeftWidth: 3, borderLeftColor: 'primary.main' }
          : undefined
      }
    >
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
            {menu}
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
            {COUNT_LABELS.map(({ key, label, color }) => {
              const count = advisee.activities[key];
              // A contagem que espera o professor (RN21) ganha um fundo teal suave, sem peso extra
              // de cor; as zeradas ficam neutras, sem opacidade, para continuarem legíveis (4,5:1).
              const waitsForTeacher = key === 'inReview' && count > 0;
              return (
                <li key={key}>
                  <Chip
                    label={`${label}: ${count}`}
                    color={count === 0 ? 'default' : color}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontWeight: waitsForTeacher ? 600 : undefined,
                      bgcolor: waitsForTeacher ? 'primary.light' : undefined,
                      borderColor: waitsForTeacher ? 'primary.main' : undefined,
                      color: waitsForTeacher
                        ? 'primary.dark'
                        : count === 0
                          ? 'text.secondary'
                          : undefined,
                    }}
                  />
                </li>
              );
            })}
          </Stack>
        </Stack>
      </CardContent>
      {actions && (
        <CardActions
          sx={{
            px: 2,
            pb: 2,
            gap: 1,
            // No celular os botões ocupam a largura toda, um por linha, e não quebram de forma solta.
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            '& > :not(style) ~ :not(style)': { ml: 0 },
          }}
        >
          {actions}
        </CardActions>
      )}
    </Card>
  );
}
