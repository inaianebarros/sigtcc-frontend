import { httpClient } from './httpClient';

export interface StudentRegistration {
  registration_number: string;
  full_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  institute_id: number;
  course_id: number;
  area_ids: number[];
}

export function registerStudent(
  registration: StudentRegistration,
): Promise<void> {
  return httpClient.post<void>('/auth/register/aluno', registration);
}
