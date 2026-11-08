import { ApiError } from './apiError';
import { httpClient } from './httpClient';
import type { PublishedArticle } from './profileService';

export interface LinkedStudentProfile {
  id: number;
  fullName: string;
  institute: { id: number; name: string };
  course: { id: number; name: string };
  areas: { id: number; name: string; isCommon: boolean }[];
  /** Quantas áreas são em comum com o professor, como o servidor calculou (RN23). */
  compatibility: number;
  articles: PublishedArticle[];
}

interface ApiLinkedStudentProfile {
  id: number;
  full_name: string;
  institute: { id: number; name: string };
  course: { id: number; name: string };
  areas: { id: number; name: string; is_common: boolean }[];
  compatibility: number;
  articles: PublishedArticle[];
}

/**
 * O perfil de um aluno vinculado ao professor (RF11, RN32). O servidor responde o mesmo 404 para
 * um aluno sem vínculo, um inativo e um id que não existe, e aqui isso vira `null`: a tela não
 * deve distinguir os casos.
 */
export async function getLinkedStudentProfile(
  studentId: number,
): Promise<LinkedStudentProfile | null> {
  try {
    const profile = await httpClient.get<ApiLinkedStudentProfile>(
      `/alunos/${studentId}/perfil`,
    );
    return {
      id: profile.id,
      fullName: profile.full_name,
      institute: profile.institute,
      course: profile.course,
      areas: profile.areas.map((area) => ({
        id: area.id,
        name: area.name,
        isCommon: area.is_common,
      })),
      compatibility: profile.compatibility,
      articles: profile.articles,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
