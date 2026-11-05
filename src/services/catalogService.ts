import { httpClient } from './httpClient';

export interface Institute {
  id: number;
  name: string;
}

export interface Course {
  id: number;
  institute_id: number;
  name: string;
}

export interface AreaOfInterest {
  id: number;
  name: string;
}

export function listInstitutes(): Promise<Institute[]> {
  return httpClient.get<Institute[]>('/institutos');
}

export function listCourses(instituteId: number): Promise<Course[]> {
  return httpClient.get<Course[]>(`/cursos?institute_id=${instituteId}`);
}

export function listAreasOfInterest(): Promise<AreaOfInterest[]> {
  return httpClient.get<AreaOfInterest[]>('/areas-de-interesse');
}
