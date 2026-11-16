import { Typography } from '@mui/material';
import { useId, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useLoad } from '../hooks/useLoad';
import { backLabelFor, originPath } from '../navigation/origin';
import { positiveIntFrom } from '../navigation/positiveInt';
import { paths } from '../navigation/paths';
import { AreaChips } from '../profile/AreaChips';
import { ArticleList } from '../profile/ArticleList';
import { ProfileSection } from '../profile/ProfileSection';
import { ProfileView } from '../profile/ProfileView';
import { SectionCount } from '../profile/SectionCount';
import { StudentProfileHeader } from '../profile/StudentProfileHeader';
import { getLinkedStudentProfile } from '../services/linkedStudentService';

/** O perfil de um aluno vinculado, para o professor (RF11, RN32): só leitura, sem contato. */
export function StudentProfileViewPage() {
  const { studentId } = useParams();
  // Só um inteiro de 1 em diante é um id: qualquer outra coisa na URL é um aluno que não existe.
  const id = positiveIntFrom(studentId);
  const origin = originPath(useLocation().state, 'professor');
  const backPath = origin ?? paths.teacherRequests;
  const [reload, setReload] = useState(0);
  // Sem um id válido a API nem é chamada: a chave nula deixa a carga parada.
  const profile = useLoad(
    () => (id === null ? Promise.resolve(null) : getLinkedStudentProfile(id)),
    id === null ? null : `${id}|${reload}`,
  );
  const areasId = useId();
  const articlesId = useId();

  return (
    <ProfileView
      backPath={backPath}
      backLabel={backLabelFor(origin)}
      notFoundTitle="Aluno não encontrado"
      genericTitle="Perfil do aluno"
      skeletonTestId="student-profile-skeleton"
      invalidId={id === null}
      profileLayout
      profile={profile}
      onRetry={() => setReload((current) => current + 1)}
      title={(student) => student.fullName}
      heading={(student) => (
        <StudentProfileHeader
          fullName={student.fullName}
          course={student.course.name}
          institute={student.institute.name}
        />
      )}
    >
      {(student) => (
        <>
          <ProfileSection id={areasId} title="Áreas de interesse">
            {student.areas.length === 0 ? (
              <Typography color="text.secondary">
                Este aluno ainda não cadastrou áreas de interesse.
              </Typography>
            ) : (
              // As em comum com o professor primeiro (RN23); a ordem das demais se mantém.
              <AreaChips
                areas={[...student.areas].sort(
                  (a, b) => Number(b.isCommon) - Number(a.isCommon),
                )}
                labelledBy={`${areasId}-title`}
                announceCount
              />
            )}
          </ProfileSection>
          <ProfileSection
            id={articlesId}
            title="Artigos publicados"
            aside={
              <SectionCount
                count={student.articles.length}
                singular="artigo"
                plural="artigos"
              />
            }
          >
            <ArticleList
              articles={student.articles}
              emptyText="Este aluno ainda não cadastrou artigos."
            />
          </ProfileSection>
        </>
      )}
    </ProfileView>
  );
}
