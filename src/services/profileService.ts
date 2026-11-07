import { httpClient } from './httpClient';

export interface PublishedArticle {
  title: string;
  year: number;
  url: string;
}

export interface StudentProfile {
  fullName: string;
  email: string;
  registrationNumber: string;
  instituteId: number;
  courseId: number;
  areaIds: number[];
  articles: PublishedArticle[];
}

interface ApiStudentProfile {
  full_name: string;
  email: string;
  registration_number: string;
  institute_id: number;
  course_id: number;
  area_ids: number[];
  articles: PublishedArticle[];
}

function toStudentProfile(profile: ApiStudentProfile): StudentProfile {
  return {
    fullName: profile.full_name,
    email: profile.email,
    registrationNumber: profile.registration_number,
    instituteId: profile.institute_id,
    courseId: profile.course_id,
    areaIds: profile.area_ids,
    articles: profile.articles,
  };
}

export async function getStudentProfile(): Promise<StudentProfile> {
  return toStudentProfile(
    await httpClient.get<ApiStudentProfile>('/alunos/me/perfil'),
  );
}

export interface StudentProfileChanges {
  fullName?: string;
  areaIds?: number[];
  articles?: PublishedArticle[];
}

export async function updateStudentProfile(
  changes: StudentProfileChanges,
): Promise<StudentProfile> {
  return toStudentProfile(
    await httpClient.patch<ApiStudentProfile>('/alunos/me/perfil', {
      full_name: changes.fullName,
      area_ids: changes.areaIds,
      articles: changes.articles,
    }),
  );
}

export interface TeacherProfile {
  fullName: string;
  email: string;
  registrationNumber: string;
  instituteId: number | null;
  courseIds: number[];
  areaIds: number[];
  isAvailable: boolean;
  articles: PublishedArticle[];
}

interface ApiTeacherProfile {
  full_name: string;
  email: string;
  registration_number: string;
  institute_id: number | null;
  course_ids: number[];
  area_ids: number[];
  is_available: boolean;
  articles: PublishedArticle[];
}

function toTeacherProfile(profile: ApiTeacherProfile): TeacherProfile {
  return {
    fullName: profile.full_name,
    email: profile.email,
    registrationNumber: profile.registration_number,
    instituteId: profile.institute_id,
    courseIds: profile.course_ids,
    areaIds: profile.area_ids,
    isAvailable: profile.is_available,
    articles: profile.articles,
  };
}

export async function getTeacherProfile(): Promise<TeacherProfile> {
  return toTeacherProfile(
    await httpClient.get<ApiTeacherProfile>('/professores/me/perfil'),
  );
}

export interface TeacherProfileChanges extends StudentProfileChanges {
  courseIds?: number[];
  isAvailable?: boolean;
}

export async function updateTeacherProfile(
  changes: TeacherProfileChanges,
): Promise<TeacherProfile> {
  return toTeacherProfile(
    await httpClient.patch<ApiTeacherProfile>('/professores/me/perfil', {
      full_name: changes.fullName,
      course_ids: changes.courseIds,
      area_ids: changes.areaIds,
      is_available: changes.isAvailable,
      articles: changes.articles,
    }),
  );
}
