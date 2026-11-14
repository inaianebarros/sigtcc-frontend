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
 * relatório" abre (RF61).
 */
export function EndedAdvisingCard({
  advising,
  counterpartPath,
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
            <Typography id={titleId} variant="h6" component="h2">
              <OriginLink to={counterpartPath}>
                {advising.counterpart.fullName}
              </OriginLink>
            </Typography>
            <Chip
              label="Encerrada"
              color="success"
              size="small"
              variant="outlined"
            />
          </Stack>
          <div>
            <Typography variant="body2" color="text.secondary">
              Tema da orientação
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
          <Typography sx={{ alignSelf: 'flex-end' }}>
            <OriginLink to={reportPath}>
              Ver relatório
              <VisuallyHidden>
                {' '}
                de {advising.counterpart.fullName}
              </VisuallyHidden>
            </OriginLink>
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
