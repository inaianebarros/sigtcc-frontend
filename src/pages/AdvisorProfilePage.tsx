import {
  Alert,
  Button,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useId, useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { EligibilityNotice } from '../advisors/EligibilityNotice';
import { RequestAdvisingButton } from '../advisors/RequestAdvisingButton';
import { RequestAdvisingDialog } from '../advisors/RequestAdvisingDialog';
import { useRequestAdvising } from '../advisors/useRequestAdvising';
import { useLoad } from '../hooks/useLoad';
import { originPath } from '../navigation/origin';
import { positiveIntFrom } from '../navigation/positiveInt';
import { paths } from '../navigation/paths';
import { ArticleList } from '../profile/ArticleList';
import { CommonAreaChips } from '../profile/CommonAreaChips';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import { getAdvisorProfile } from '../services/advisorProfileService';

/** O perfil de um professor do curso do aluno (RF10), com o botão de solicitar orientação (RF12). */
export function AdvisorProfilePage() {
  const { teacherId } = useParams();
  // Só um inteiro de 1 em diante é um id: qualquer outra coisa na URL é um professor que não existe.
  const id = positiveIntFrom(teacherId);
  const backPath =
    originPath(useLocation().state, 'aluno') ?? paths.studentAdvisors;
  const [reload, setReload] = useState(0);
  // Sem um id válido a API nem é chamada: a chave nula deixa a carga parada.
  const profile = useLoad(
    () => (id === null ? Promise.resolve(null) : getAdvisorProfile(id)),
    id === null ? null : `${id}|${reload}`,
  );
  // A solicitação é a mesma da busca; um 409 relê também o perfil.
  const request = useRequestAdvising({
    onConflict: () => setReload((current) => current + 1),
  });
  const availabilityId = useId();

  const notFound =
    id === null || (profile.status === 'ready' && profile.data === null);

  return (
    <Stack spacing={3} sx={{ maxWidth: 720, mx: 'auto' }}>
      <Link
        component={RouterLink}
        to={backPath}
        sx={{ alignSelf: 'flex-start' }}
      >
        Voltar
      </Link>
      {notFound && (
        <Typography variant="h4" component="h1">
          Professor não encontrado
        </Typography>
      )}
      {/* O nome do professor só chega com o perfil: até lá, e no erro, a página tem um título geral. */}
      {!notFound && profile.status !== 'ready' && (
        <Typography variant="h4" component="h1">
          Perfil do professor
        </Typography>
      )}
      {!notFound && profile.status === 'loading' && (
        <Stack spacing={2} data-testid="advisor-profile-skeleton" aria-hidden>
          <Skeleton variant="rounded" height={80} />
          <Skeleton variant="rounded" height={120} />
        </Stack>
      )}
      {!notFound && profile.status === 'error' && (
        <Stack spacing={2}>
          <Alert severity="error">{profile.message}</Alert>
          <Button
            onClick={() => setReload((current) => current + 1)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Tentar novamente
          </Button>
        </Stack>
      )}
      {profile.status === 'ready' && profile.data !== null && (
        <>
          <Typography variant="h4" component="h1">
            {profile.data.fullName}
          </Typography>
          <ReadOnlyFacts
            facts={[
              ['Instituto', profile.data.institute.name],
              [
                'Cursos',
                profile.data.courses.map((course) => course.name).join(', ') ||
                  'Nenhum curso cadastrado',
              ],
            ]}
          />
          <Typography id={availabilityId}>
            {profile.data.isAvailable
              ? 'Disponível para orientar'
              : 'Este professor não está disponível para novas solicitações.'}
          </Typography>
          <EligibilityNotice
            id={request.noticeId}
            eligibility={request.eligibility}
            onRetry={request.reloadEligibility}
          />
          <RequestAdvisingButton
            advisor={profile.data}
            canRequest={request.canRequest}
            blockedNoticeId={request.blockedNoticeId}
            unavailableId={availabilityId}
            onRequest={request.ask}
          />
          <Stack spacing={1.5} component="section">
            <Typography variant="h6" component="h2">
              Áreas de interesse
            </Typography>
            <CommonAreaChips
              areas={profile.data.areas}
              compatibility={profile.data.compatibility}
            />
          </Stack>
          <Stack spacing={1.5} component="section">
            <Typography variant="h6" component="h2">
              Artigos publicados
            </Typography>
            <ArticleList articles={profile.data.articles} />
          </Stack>
        </>
      )}
      <RequestAdvisingDialog {...request.dialog} />
    </Stack>
  );
}
