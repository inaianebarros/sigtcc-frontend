import SchoolIcon from '@mui/icons-material/School';
import { Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import { OriginLink } from '../navigation/OriginLink';
import { studentAdvisorPath } from '../navigation/paths';
import type { MyRequestItem } from '../services/advisorService';
import { RequestStatusChip } from './requestStatus';
import { requestDateLines } from './requestDateLines';

// O status vem do servidor como texto: um valor novo cai no neutro e não derruba a tela.
const STATUS_COLOR: Record<string, 'default' | 'primary' | 'warning'> = {
  pending: 'warning',
  accepted: 'primary',
  rejected: 'default',
  unanswered: 'default',
};

/**
 * Uma solicitação do aluno (RF16): o professor, com o link para o perfil dele e o instituto, as
 * datas, a situação e, quando aceita, a orientação que ela criou. Sem avatar e sem ações: o aluno
 * não cancela nem altera a solicitação (RN05, RN06).
 */
export function StudentRequestCard({ request }: { request: MyRequestItem }) {
  const titleId = useId();
  const { advising } = request;
  return (
    <Card component="article" aria-labelledby={titleId}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack spacing={0.25}>
            <Typography
              id={titleId}
              variant="h3"
              component="h2"
              sx={{ overflowWrap: 'anywhere' }}
            >
              <OriginLink to={studentAdvisorPath(request.teacher.id)}>
                {request.teacher.fullName}
              </OriginLink>
            </Typography>
            {request.teacher.institute && (
              <Typography variant="body2" color="text.secondary">
                {request.teacher.institute.name}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
            <RequestStatusChip
              status={request.status}
              color={STATUS_COLOR[request.status] ?? 'default'}
            />
            {request.status === 'accepted' && advising && (
              <Chip
                variant="outlined"
                icon={advising.status === 'active' ? <SchoolIcon /> : undefined}
                color={advising.status === 'active' ? 'primary' : 'default'}
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
          <Stack
            component="ul"
            spacing={0.25}
            sx={{ m: 0, p: 0, listStyle: 'none' }}
          >
            {requestDateLines(request).map((line) => (
              <Typography
                component="li"
                key={line}
                variant="body2"
                color="text.secondary"
              >
                {line}
              </Typography>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
