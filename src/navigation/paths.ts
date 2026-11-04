import type { UserType } from '../types/session';

export const paths = {
  home: '/',
  login: '/login',
  forgotPassword: '/recuperar-senha',
  registerStudent: '/cadastro/aluno',
  registerTeacher: '/cadastro/professor',
  student: '/aluno',
  teacher: '/professor',
  admin: '/admin',
} as const;

const homeByUserType: Record<UserType, string> = {
  student: paths.student,
  teacher: paths.teacher,
  admin: paths.admin,
};

export function homePathFor(userType: UserType): string {
  return homeByUserType[userType];
}
