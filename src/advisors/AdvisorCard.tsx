import {
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { OriginLink } from '../navigation/OriginLink';
import { studentAdvisorPath } from '../navigation/paths';
import type { Advisor } from '../services/advisorService';
import { RequestAdvisingButton } from './RequestAdvisingButton';
import type { AdvisorToAsk } from './useRequestAdvising';

/** Quantas propostas a API devolve por professor: o que passa disso vira "+ N outras propostas". */
const SHOWN_PROPOSALS = 3;

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
              sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
            >
              <Typography id={titleId} variant="h6" component="h2">
                <OriginLink to={studentAdvisorPath(advisor.id)}>
                  {advisor.fullName}
                </OriginLink>
              </Typography>
              {advisor.isAvailable ? (
                <Chip
                  label="Disponível para orientar"
                  size="small"
                  color="success"
                  variant="outlined"
                />
              ) : (
                <Chip label="Indisponível" size="small" variant="outlined" />
              )}
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
              <Stack
                component="ul"
                aria-labelledby={areasId}
                direction="row"
                useFlexGap
                sx={{ flexWrap: 'wrap', gap: 1, m: 0, p: 0, listStyle: 'none' }}
              >
                {advisor.areas.map((area) => (
                  <li key={area.id}>
                    <Chip
                      size="small"
                      color={area.isCommon ? 'success' : 'default'}
                      variant={area.isCommon ? 'filled' : 'outlined'}
                      label={
                        <>
                          {area.name}
                          {area.isCommon && (
                            <VisuallyHidden>, em comum</VisuallyHidden>
                          )}
                        </>
                      }
                    />
                  </li>
                ))}
              </Stack>
            </Stack>
          )}
          {proposals.length > 0 && (
            <Stack spacing={1}>
              <Typography id={proposalsId} variant="subtitle2" component="h3">
                Temas propostos
              </Typography>
              <Stack
                component="ul"
                aria-labelledby={proposalsId}
                spacing={0.5}
                sx={{ m: 0, pl: 2.5 }}
              >
                {proposals.map((proposal) => (
                  <Typography key={proposal.id} component="li">
                    {proposal.title}
                  </Typography>
                ))}
              </Stack>
              {total > SHOWN_PROPOSALS && (
                <Typography variant="body2" color="text.secondary">
                  {moreProposalsText(total - SHOWN_PROPOSALS)}
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
