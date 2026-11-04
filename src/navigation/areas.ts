import type { UserType } from '../types/session';

export interface Area {
  userType: UserType;
  path: string;
  title: string;
}

export const areas: readonly Area[] = [
  { userType: 'student', path: '/aluno', title: 'Área do Aluno' },
  { userType: 'teacher', path: '/professor', title: 'Área do Professor' },
  { userType: 'admin', path: '/admin', title: 'Área do Administrador' },
];
