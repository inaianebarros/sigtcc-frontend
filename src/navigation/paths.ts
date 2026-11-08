import type { UserType } from '../types/session';
import { areas } from './areas';

export const paths = {
  home: '/',
  login: '/login',
  forgotPassword: '/recuperar-senha',
  resetPassword: '/redefinir-senha',
  registerStudent: '/cadastro/aluno',
  registerTeacher: '/cadastro/professor',
  studentAdvisors: '/aluno/orientadores',
  studentRequest: '/aluno/solicitacao',
  teacherRequests: '/professor/solicitacoes',
  studentProfile: '/aluno/perfil',
  studentPassword: '/aluno/perfil/senha',
  teacherProfile: '/professor/perfil',
  teacherPassword: '/professor/perfil/senha',
  teacherStudent: '/professor/alunos/:studentId',
} as const;

export function teacherStudentPath(studentId: number): string {
  return paths.teacherStudent.replace(':studentId', String(studentId));
}

export function homePathFor(userType: UserType): string {
  const area = areas.find((candidate) => candidate.userType === userType);
  return area?.path ?? paths.home;
}
