import { nullOnNotFound } from './apiError';
import { httpClient } from './httpClient';
import type { PublishedArticle } from './profileService';
import { toProfileAreas } from './profileAreas';
import type { ApiProfileArea, ProfileAreaView } from './profileAreas';

export interface LinkedStudentProfile {
  id: number;
  fullName: string;
  institute: { id: number; name: string };
  course: { id: number; name: string };
  areas: ProfileAreaView[];
  /** Quantas áreas são em comum com o professor, como o servidor calculou (RN23). */
  compatibility: number;
  articles: PublishedArticle[];
}

interface ApiLinkedStudentProfile {
  id: number;
  full_name: string;
  institute: { id: number; name: string };
  course: { id: number; name: string };
  areas: ApiProfileArea[];
  compatibility: number;
  articles: PublishedArticle[];
}

/**
 * O perfil de um aluno vinculado ao professor (RF11, RN32). O servidor responde o mesmo 404 para
 * um aluno sem vínculo, um inativo e um id que não existe, e aqui isso vira `null`.
 */
export async function getLinkedStudentProfile(
  studentId: number,
): Promise<LinkedStudentProfile | null> {
  const profile = await nullOnNotFound(
    httpClient.get<ApiLinkedStudentProfile>(`/alunos/${studentId}/perfil`),
  );
  if (profile === null) return null;
  return {
    id: profile.id,
    fullName: profile.full_name,
    institute: profile.institute,
    course: profile.course,
    areas: toProfileAreas(profile.areas),
    compatibility: profile.compatibility,
    articles: profile.articles,
  };
}
