import {
  Alert,
  Button,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { useLoad } from '../hooks/useLoad';
import { originPath } from '../navigation/origin';
import { positiveIntFrom } from '../navigation/positiveInt';
import { paths } from '../navigation/paths';
import { ArticleList } from '../profile/ArticleList';
import { CommonAreaChips } from '../profile/CommonAreaChips';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import { getLinkedStudentProfile } from '../services/linkedStudentService';

/** O perfil de um aluno vinculado, para o professor (RF11, RN32): só leitura, sem contato. */
export function StudentProfileViewPage() {
  const { studentId } = useParams();
  // Só um inteiro de 1 em diante é um id: qualquer outra coisa na URL é um aluno que não existe.
  const id = positiveIntFrom(studentId);
  const backPath = originPath(useLocation().state) ?? paths.teacherRequests;
  const [reload, setReload] = useState(0);
  // Sem um id válido a API nem é chamada: a chave nula deixa a carga parada.
  const profile = useLoad(
    () => (id === null ? Promise.resolve(null) : getLinkedStudentProfile(id)),
    id === null ? null : `${id}|${reload}`,
  );

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
          Aluno não encontrado
        </Typography>
      )}
      {/* O nome do aluno só chega com o perfil: até lá, e no erro, a página tem um título geral. */}
      {!notFound && profile.status !== 'ready' && (
        <Typography variant="h4" component="h1">
          Perfil do aluno
        </Typography>
      )}
      {!notFound && profile.status === 'loading' && (
        <Stack spacing={2} data-testid="student-profile-skeleton" aria-hidden>
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
              ['Curso', profile.data.course.name],
            ]}
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
    </Stack>
  );
}
