import { Chip, Stack, Typography } from '@mui/material';
import { useId, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AdvisorProfileHeader } from '../advisors/AdvisorProfileHeader';
import { EligibilityNotice } from '../advisors/EligibilityNotice';
import { RequestAdvisingButton } from '../advisors/RequestAdvisingButton';
import { RequestAdvisingDialog } from '../advisors/RequestAdvisingDialog';
import { useRequestAdvising } from '../advisors/useRequestAdvising';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { useLoad } from '../hooks/useLoad';
import { originPath } from '../navigation/origin';
import { positiveIntFrom } from '../navigation/positiveInt';
import { paths } from '../navigation/paths';
import { AdvisorThesisProposals } from '../proposals/AdvisorThesisProposals';
import { ArticleList } from '../profile/ArticleList';
import { AreaChips } from '../profile/AreaChips';
import { ProfileView } from '../profile/ProfileView';
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
  const coursesId = useId();
  const areasId = useId();
  const articlesId = useId();
  const requestId = useId();
  const unavailableId = useId();

  return (
    <>
      <ProfileView
        backPath={backPath}
        notFoundTitle="Professor não encontrado"
        genericTitle="Perfil do professor"
        skeletonTestId="advisor-profile-skeleton"
        invalidId={id === null}
        profileLayout
        profile={profile}
        onRetry={() => setReload((current) => current + 1)}
        title={(advisor) => advisor.fullName}
        heading={(advisor) => (
          <AdvisorProfileHeader
            fullName={advisor.fullName}
            institute={advisor.institute.name}
            isAvailable={advisor.isAvailable}
          />
        )}
      >
        {(advisor) => (
          <>
            <Stack
              spacing={1.5}
              component="section"
              aria-labelledby={coursesId}
            >
              <Typography id={coursesId} variant="h3" component="h2">
                Cursos vinculados
              </Typography>
              {advisor.courses.length === 0 ? (
                <Typography>Nenhum curso cadastrado</Typography>
              ) : (
                <Stack
                  component="ul"
                  aria-labelledby={coursesId}
                  direction="row"
                  useFlexGap
                  sx={{
                    flexWrap: 'wrap',
                    gap: 1,
                    m: 0,
                    p: 0,
                    listStyle: 'none',
                  }}
                >
                  {advisor.courses.map((course) => (
                    <li key={course.id}>
                      <Chip label={course.name} size="small" />
                    </li>
                  ))}
                </Stack>
              )}
            </Stack>
            <Stack spacing={1.5} component="section" aria-labelledby={areasId}>
              <Typography id={areasId} variant="h3" component="h2">
                Áreas de interesse
              </Typography>
              {advisor.areas.length === 0 ? (
                <Typography>Nenhuma área de interesse cadastrada.</Typography>
              ) : (
                <AreaChips areas={advisor.areas} labelledBy={areasId} />
              )}
            </Stack>
            <Stack
              spacing={1.5}
              component="section"
              aria-labelledby={articlesId}
            >
              <Typography id={articlesId} variant="h3" component="h2">
                Artigos publicados
              </Typography>
              <ArticleList articles={advisor.articles} />
            </Stack>
            <AdvisorThesisProposals key={advisor.id} teacherId={advisor.id} />
            <Stack
              spacing={1.5}
              component="section"
              aria-labelledby={requestId}
            >
              <Typography id={requestId} variant="h3" component="h2">
                Solicitar orientação
              </Typography>
              <Typography>
                Envie uma solicitação para este professor.
              </Typography>
              <EligibilityNotice {...request.notice} />
              {!advisor.isAvailable && (
                <VisuallyHidden id={unavailableId}>
                  Este professor não está disponível para novas solicitações.
                </VisuallyHidden>
              )}
              <RequestAdvisingButton
                advisor={advisor}
                {...request.requesting}
                unavailableId={unavailableId}
              />
            </Stack>
          </>
        )}
      </ProfileView>
      <RequestAdvisingDialog {...request.dialog} />
    </>
  );
}
