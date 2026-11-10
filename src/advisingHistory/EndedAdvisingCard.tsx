import { Card, CardContent, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import { formatDate } from '../formatters/dateTime';
import type { EndedAdvising } from '../services/advisingHistoryService';

interface EndedAdvisingCardProps {
  advising: EndedAdvising;
  /** O papel da outra parte, visto de quem consulta: "Professor orientador" ou "Aluno". */
  counterpartRole: string;
}

/** Uma orientação encerrada: a outra parte, as datas, o motivo e o tema congelado (RF49). */
export function EndedAdvisingCard({
  advising,
  counterpartRole,
}: EndedAdvisingCardProps) {
  const titleId = useId();
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <div>
            <Typography id={titleId} variant="h6" component="h2">
              {advising.counterpart.fullName}
            </Typography>
            <Typography color="text.secondary">{counterpartRole}</Typography>
          </div>
          <Typography color="text.secondary">
            Orientação iniciada em {formatDate(advising.startedAt)}
          </Typography>
          <Typography color="text.secondary">
            Orientação encerrada em {formatDate(advising.endedAt)}
          </Typography>
          <div>
            <Typography variant="subtitle2" component="p">
              Motivo do encerramento
            </Typography>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              {advising.reason}
            </Typography>
          </div>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {advising.thesisTopic
              ? `Tema: ${advising.thesisTopic}`
              : 'Sem tema cadastrado'}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
