import type { UserType } from '../types/session';
import { areas } from './areas';

export const paths = {
  home: '/',
  login: '/login',
  forgotPassword: '/recuperar-senha',
  resetPassword: '/redefinir-senha',
  registerStudent: '/cadastro/aluno',
  registerTeacher: '/cadastro/professor',
  studentRequest: '/aluno/solicitacao',
} as const;

export function homePathFor(userType: UserType): string {
  const area = areas.find((candidate) => candidate.userType === userType);
  return area?.path ?? paths.home;
}
