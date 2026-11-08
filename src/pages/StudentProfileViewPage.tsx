import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useLoad } from '../hooks/useLoad';
import { originPath } from '../navigation/origin';
import { positiveIntFrom } from '../navigation/positiveInt';
import { paths } from '../navigation/paths';
import { ProfileSections } from '../profile/ProfileSections';
import { ProfileView } from '../profile/ProfileView';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import { getLinkedStudentProfile } from '../services/linkedStudentService';

/** O perfil de um aluno vinculado, para o professor (RF11, RN32): só leitura, sem contato. */
export function StudentProfileViewPage() {
  const { studentId } = useParams();
  // Só um inteiro de 1 em diante é um id: qualquer outra coisa na URL é um aluno que não existe.
  const id = positiveIntFrom(studentId);
  const backPath =
    originPath(useLocation().state, 'professor') ?? paths.teacherRequests;
  const [reload, setReload] = useState(0);
  // Sem um id válido a API nem é chamada: a chave nula deixa a carga parada.
  const profile = useLoad(
    () => (id === null ? Promise.resolve(null) : getLinkedStudentProfile(id)),
    id === null ? null : `${id}|${reload}`,
  );

  return (
    <ProfileView
      backPath={backPath}
      notFoundTitle="Aluno não encontrado"
      genericTitle="Perfil do aluno"
      skeletonTestId="student-profile-skeleton"
      invalidId={id === null}
      profile={profile}
      onRetry={() => setReload((current) => current + 1)}
      title={(student) => student.fullName}
    >
      {(student) => (
        <>
          <ReadOnlyFacts
            facts={[
              ['Instituto', student.institute.name],
              ['Curso', student.course.name],
            ]}
          />
          <ProfileSections
            areas={student.areas}
            compatibility={student.compatibility}
            articles={student.articles}
          />
        </>
      )}
    </ProfileView>
  );
}
