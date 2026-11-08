import { nullOnNotFound } from './apiError';
import { httpClient } from './httpClient';
import type { PublishedArticle } from './profileService';
import { toProfileAreas } from './profileAreas';
import type { ApiProfileArea, ProfileAreaView } from './profileAreas';

export interface AdvisorProfile {
  id: number;
  fullName: string;
  institute: { id: number; name: string };
  courses: { id: number; name: string }[];
  areas: ProfileAreaView[];
  /** Quantas áreas são em comum com o aluno, como o servidor calculou (RN23). */
  compatibility: number;
  isAvailable: boolean;
  articles: PublishedArticle[];
}

interface ApiAdvisorProfile {
  id: number;
  full_name: string;
  institute: { id: number; name: string };
  courses: { id: number; name: string }[];
  areas: ApiProfileArea[];
  compatibility: number;
  is_available: boolean;
  articles: PublishedArticle[];
}

/**
 * O perfil de um professor do curso do aluno (RF10, RN28). O servidor responde o mesmo 404 para
 * um professor de outro curso, um inativo e um id que não existe, e aqui isso vira `null`.
 */
export async function getAdvisorProfile(
  teacherId: number,
): Promise<AdvisorProfile | null> {
  const profile = await nullOnNotFound(
    httpClient.get<ApiAdvisorProfile>(`/professores/${teacherId}/perfil`),
  );
  if (profile === null) return null;
  return {
    id: profile.id,
    fullName: profile.full_name,
    institute: profile.institute,
    courses: profile.courses,
    areas: toProfileAreas(profile.areas),
    compatibility: profile.compatibility,
    isAvailable: profile.is_available,
    articles: profile.articles,
  };
}
