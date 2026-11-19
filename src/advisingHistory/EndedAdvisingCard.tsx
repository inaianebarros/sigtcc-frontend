import {
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import { formatShortDate } from '../formatters/dateTime';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { OriginLink } from '../navigation/OriginLink';
import type { EndedAdvising } from '../services/advisingHistoryService';

interface EndedAdvisingCardProps {
  advising: EndedAdvising;
  /** O perfil da outra parte: o do professor, para o aluno, e o do aluno, para o professor. */
  counterpartPath: string;
  /** O papel da outra parte, escrito acima do nome: "Orientador(a)" ou "Orientando(a)". */
  counterpartRole: string;
  /** O relatório da orientação (RF61). */
  reportPath: string;
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography>{formatShortDate(value)}</Typography>
    </Stack>
  );
}

/**
 * Uma orientação encerrada: a outra parte (o professor, para o aluno; o aluno, para o professor),
 * o tema congelado e as datas (RF49). O motivo do encerramento fica no relatório, que o "Ver
 * relatório da orientação" abre (RF61).
 */
export function EndedAdvisingCard({
  advising,
  counterpartPath,
  counterpartRole,
  reportPath,
}: EndedAdvisingCardProps) {
  const titleId = useId();
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <div>
              <Typography variant="caption" color="text.secondary">
                {counterpartRole}
              </Typography>
              <Typography id={titleId} variant="h6" component="h2">
                <OriginLink to={counterpartPath}>
                  {advising.counterpart.fullName}
                </OriginLink>
              </Typography>
            </div>
            <Chip
              label="Encerrada"
              color="success"
              size="small"
              variant="outlined"
            />
          </Stack>
          <div>
            <Typography variant="body2" color="text.secondary">
              Tema do TCC
            </Typography>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              {advising.thesisTopic ?? 'Sem tema cadastrado'}
            </Typography>
          </div>
          <Divider />
          <Stack spacing={1}>
            <DateRow label="Início" value={advising.startedAt} />
            <DateRow label="Encerramento" value={advising.endedAt} />
          </Stack>
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              O motivo do encerramento está no relatório.
            </Typography>
            <Typography>
              <OriginLink to={reportPath}>
                Ver relatório da orientação{' '}
                <VisuallyHidden>
                  com {advising.counterpart.fullName}
                </VisuallyHidden>
              </OriginLink>
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
