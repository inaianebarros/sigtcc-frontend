import SchoolIcon from '@mui/icons-material/School';
import { Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import { formatDate, formatDateTime } from '../formatters/dateTime';
import { OriginLink } from '../navigation/OriginLink';
import { studentAdvisorPath } from '../navigation/paths';
import type { MyRequestItem } from '../services/advisorService';
import { RequestStatusChip } from './requestStatus';

/** Por que uma solicitação não pendente não muda mais (RN06 e RN20). */
function whyClosed(status: MyRequestItem['status']): string {
  if (status === 'unanswered') {
    return 'O prazo para o professor responder acabou, e a solicitação não pode mais ser respondida.';
  }
  return 'Esta solicitação já foi respondida e não pode ser alterada.';
}

/**
 * Uma solicitação do aluno (RF16), no mesmo formato do cartão do professor: o professor, com o
 * link para o perfil e o instituto, as datas, a situação e, quando aceita, a orientação que ela
 * criou. Sem ações: o aluno não cancela nem altera a solicitação (RN05, RN06).
 */
export function StudentRequestCard({ request }: { request: MyRequestItem }) {
  const titleId = useId();
  const { advising } = request;
  const pending = request.status === 'pending';
  return (
    <Card
      component="article"
      aria-labelledby={titleId}
      variant="outlined"
      tabIndex={-1}
      sx={{
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
        },
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Typography
            id={titleId}
            variant="h6"
            component="h2"
            sx={{ overflowWrap: 'anywhere' }}
          >
            <OriginLink to={studentAdvisorPath(request.teacher.id)}>
              {request.teacher.fullName}
            </OriginLink>
          </Typography>
          {request.teacher.institute && (
            <Typography color="text.secondary">
              {request.teacher.institute.name}
            </Typography>
          )}
          <Typography color="text.secondary">
            Enviada em {formatDate(request.requestedAt)}
          </Typography>
          {request.respondedAt && (
            <Typography color="text.secondary">
              Respondida em {formatDate(request.respondedAt)}
            </Typography>
          )}
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
            <RequestStatusChip status={request.status} />
            {request.status === 'accepted' && advising && (
              <Chip
                variant="outlined"
                icon={advising.status === 'active' ? <SchoolIcon /> : undefined}
                label={
                  advising.status === 'active'
                    ? 'Orientação ativa'
                    : 'Orientação encerrada'
                }
                sx={{
                  color: 'text.primary',
                  '& .MuiChip-icon': { color: 'primary.main' },
                }}
              />
            )}
          </Stack>
          {pending && request.expiresAt && (
            <Typography>
              Prazo para o professor responder:{' '}
              {formatDateTime(request.expiresAt)}.
            </Typography>
          )}
          {advising?.status === 'ended' && advising.endedAt && (
            <Typography color="text.secondary">
              Orientação de {formatDate(advising.startedAt)} a{' '}
              {formatDate(advising.endedAt)}.
            </Typography>
          )}
          {!pending && <Typography>{whyClosed(request.status)}</Typography>}
        </Stack>
      </CardContent>
    </Card>
  );
}
