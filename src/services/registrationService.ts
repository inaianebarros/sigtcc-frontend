import { httpClient } from './httpClient';

export interface AccountRegistration {
  registration_number: string;
  full_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  institute_id: number;
  area_ids: number[];
}

export interface StudentRegistration extends AccountRegistration {
  course_id: number;
}

export function registerStudent(
  registration: StudentRegistration,
): Promise<void> {
  return httpClient.post<void>('/auth/register/aluno', registration);
}

export interface TeacherRegistration extends AccountRegistration {
  course_ids: number[];
}

export function registerTeacher(
  registration: TeacherRegistration,
): Promise<void> {
  return httpClient.post<void>('/auth/register/professor', registration);
}
