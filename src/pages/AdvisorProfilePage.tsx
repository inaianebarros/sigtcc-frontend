import { Typography } from '@mui/material';
import { useId, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { EligibilityNotice } from '../advisors/EligibilityNotice';
import { RequestAdvisingButton } from '../advisors/RequestAdvisingButton';
import { RequestAdvisingDialog } from '../advisors/RequestAdvisingDialog';
import { useRequestAdvising } from '../advisors/useRequestAdvising';
import { useLoad } from '../hooks/useLoad';
import { originPath } from '../navigation/origin';
import { positiveIntFrom } from '../navigation/positiveInt';
import { paths } from '../navigation/paths';
import { ProfileSections } from '../profile/ProfileSections';
import { ProfileView } from '../profile/ProfileView';
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

  return (
    <>
      <ProfileView
        backPath={backPath}
        notFoundTitle="Professor não encontrado"
        genericTitle="Perfil do professor"
        skeletonTestId="advisor-profile-skeleton"
        invalidId={id === null}
        profile={profile}
        onRetry={() => setReload((current) => current + 1)}
        title={(advisor) => advisor.fullName}
      >
        {(advisor) => (
          <>
            <ReadOnlyFacts
              facts={[
                ['Instituto', advisor.institute.name],
                [
                  'Cursos',
                  advisor.courses.map((course) => course.name).join(', ') ||
                    'Nenhum curso cadastrado',
                ],
              ]}
            />
            <Typography id={availabilityId}>
              {advisor.isAvailable
                ? 'Disponível para orientar'
                : 'Este professor não está disponível para novas solicitações.'}
            </Typography>
            <EligibilityNotice {...request.notice} />
            <RequestAdvisingButton
              advisor={advisor}
              {...request.requesting}
              unavailableId={availabilityId}
            />
            <ProfileSections
              areas={advisor.areas}
              compatibility={advisor.compatibility}
              articles={advisor.articles}
            />
          </>
        )}
      </ProfileView>
      <RequestAdvisingDialog {...request.dialog} />
    </>
  );
}
