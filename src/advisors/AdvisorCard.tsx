import {
  Card,
  CardActions,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { OriginLink } from '../navigation/OriginLink';
import { studentAdvisorPath } from '../navigation/paths';
import type { Advisor } from '../services/advisorService';
import { AreaChips } from '../profile/AreaChips';
import { AvailabilityBadge } from './AvailabilityBadge';
import { RequestAdvisingButton } from './RequestAdvisingButton';
import type { AdvisorToAsk } from './useRequestAdvising';

function moreProposalsText(hidden: number): string {
  return `+ ${hidden} ${hidden === 1 ? 'outra proposta' : 'outras propostas'}`;
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
  const areasId = useId();
  const proposalsId = useId();
  const unavailableId = useId();
  const { items: proposals, total } = advisor.thesisProposals;
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Stack
              direction="row"
              useFlexGap
              sx={{ gap: 1, alignItems: 'flex-start' }}
            >
              {/* O nome ocupa o que sobra e quebra em mais linhas; o selo fica na borda direita. */}
              <Typography
                id={titleId}
                variant="h6"
                component="h2"
                sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
              >
                <OriginLink to={studentAdvisorPath(advisor.id)}>
                  {advisor.fullName}
                </OriginLink>
              </Typography>
              <AvailabilityBadge isAvailable={advisor.isAvailable} />
            </Stack>
            <Typography color="text.secondary">
              {advisor.institute.name}
            </Typography>
          </Stack>
          {advisor.areas.length > 0 && (
            <Stack spacing={1}>
              <Typography id={areasId} variant="subtitle2" component="h3">
                Áreas de interesse
              </Typography>
              <AreaChips areas={advisor.areas} labelledBy={areasId} />
            </Stack>
          )}
          {proposals.length > 0 && (
            <Stack spacing={1}>
              <Typography id={proposalsId} variant="subtitle2" component="h3">
                Temas propostos
              </Typography>
              <Stack
                component="ul"
                // Sem marcadores o Safari deixa de anunciar a lista: o papel a mantém.
                role="list"
                aria-labelledby={proposalsId}
                spacing={0.5}
                sx={{ m: 0, p: 0, listStyle: 'none' }}
              >
                {proposals.map((proposal) => (
                  <Typography key={proposal.id} component="li">
                    {proposal.title}
                  </Typography>
                ))}
              </Stack>
              {total > proposals.length && (
                <Typography variant="body2" color="text.secondary">
                  {moreProposalsText(total - proposals.length)}
                </Typography>
              )}
            </Stack>
          )}
          {!advisor.isAvailable && (
            <VisuallyHidden id={unavailableId}>
              Este professor não está disponível para novas solicitações.
            </VisuallyHidden>
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
