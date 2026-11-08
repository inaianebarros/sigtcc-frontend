import {
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import { OriginLink } from '../navigation/OriginLink';
import { studentAdvisorPath } from '../navigation/paths';
import type { Advisor } from '../services/advisorService';
import { RequestAdvisingButton } from './RequestAdvisingButton';
import type { AdvisorToAsk } from './useRequestAdvising';

function commonAreasText(count: number): string {
  if (count === 0) return 'Nenhuma área em comum';
  return `${count} ${count === 1 ? 'área' : 'áreas'} em comum`;
}

interface AdvisorCardProps {
  advisor: Advisor;
  /** Verdadeiro quando o servidor disse que o aluno pode solicitar. */
  canRequest: boolean;
  /** O aviso do topo que explica por que o aluno não pode solicitar agora. */
  blockedNoticeId: string | null;
  onRequest: (advisor: AdvisorToAsk) => void;
}

export function AdvisorCard({
  advisor,
  canRequest,
  blockedNoticeId,
  onRequest,
}: AdvisorCardProps) {
  const titleId = useId();
  const unavailableId = useId();
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography id={titleId} variant="h6" component="h2">
            <OriginLink to={studentAdvisorPath(advisor.id)}>
              {advisor.fullName}
            </OriginLink>
          </Typography>
          <Typography color="text.secondary">
            {advisor.institute.name}
          </Typography>
          <Typography>{commonAreasText(advisor.commonAreas.length)}</Typography>
          {advisor.commonAreas.length > 0 && (
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
              {advisor.commonAreas.map((area) => (
                <Chip key={area.id} label={area.name} size="small" />
              ))}
            </Stack>
          )}
          {advisor.isAvailable ? (
            <Typography>Disponível para orientar</Typography>
          ) : (
            <Typography id={unavailableId}>
              Este professor não está disponível para novas solicitações.
            </Typography>
          )}
        </Stack>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2 }}>
        <RequestAdvisingButton
          advisor={advisor}
          canRequest={canRequest}
          blockedNoticeId={blockedNoticeId}
          unavailableId={unavailableId}
          onRequest={onRequest}
        />
      </CardActions>
    </Card>
  );
}
