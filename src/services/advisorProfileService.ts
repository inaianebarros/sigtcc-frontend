import { ApiError } from './apiError';
import { httpClient } from './httpClient';
import type { PublishedArticle } from './profileService';

export interface AdvisorProfile {
  id: number;
  fullName: string;
  institute: { id: number; name: string };
  courses: { id: number; name: string }[];
  areas: { id: number; name: string; isCommon: boolean }[];
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
  areas: { id: number; name: string; is_common: boolean }[];
  compatibility: number;
  is_available: boolean;
  articles: PublishedArticle[];
}

/**
 * O perfil de um professor do curso do aluno (RF10, RN28). O servidor responde o mesmo 404 para
 * um professor de outro curso, um inativo e um id que não existe, e aqui isso vira `null`: a
 * tela não deve distinguir os casos.
 */
export async function getAdvisorProfile(
  teacherId: number,
): Promise<AdvisorProfile | null> {
  try {
    const profile = await httpClient.get<ApiAdvisorProfile>(
      `/professores/${teacherId}/perfil`,
    );
    return {
      id: profile.id,
      fullName: profile.full_name,
      institute: profile.institute,
      courses: profile.courses,
      areas: profile.areas.map((area) => ({
        id: area.id,
        name: area.name,
        isCommon: area.is_common,
      })),
      compatibility: profile.compatibility,
      isAvailable: profile.is_available,
      articles: profile.articles,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
