import type { UserType } from '../types/session';
import { areas } from './areas';

/** O parâmetro da URL que filtra a lista de atividades de um professor por orientando (RNF30). */
export const STUDENT_FILTER_PARAM = 'aluno';

export const paths = {
  home: '/',
  login: '/login',
  forgotPassword: '/recuperar-senha',
  resetPassword: '/redefinir-senha',
  registerStudent: '/cadastro/aluno',
  registerTeacher: '/cadastro/professor',
  studentDashboard: '/aluno/dashboard',
  studentNotifications: '/aluno/notificacoes',
  teacherNotifications: '/professor/notificacoes',
  teacherDashboard: '/professor/dashboard',
  teacherAdvisees: '/professor/orientandos',
  studentAdvisingHistory: '/aluno/historico',
  teacherAdvisingHistory: '/professor/historico',
  studentAdvisors: '/aluno/orientadores',
  studentRequest: '/aluno/solicitacao',
  teacherRequests: '/professor/solicitacoes',
  studentProfile: '/aluno/perfil',
  studentPassword: '/aluno/perfil/senha',
  teacherProfile: '/professor/perfil',
  teacherPassword: '/professor/perfil/senha',
  teacherStudent: '/professor/alunos/:studentId',
  studentAdvisor: '/aluno/orientadores/:teacherId',
  studentActivities: '/aluno/atividades',
  studentThesis: '/aluno/tema',
  studentMeetings: '/aluno/reunioes',
  teacherMeetings: '/professor/reunioes',
  teacherActivities: '/professor/atividades',
  studentActivity: '/aluno/atividades/:activityId',
  teacherActivity: '/professor/atividades/:activityId',
} as const;

export function teacherStudentPath(studentId: number): string {
  return paths.teacherStudent.replace(':studentId', String(studentId));
}

export function teacherActivitiesOfStudentPath(studentId: number): string {
  return `${paths.teacherActivities}?${STUDENT_FILTER_PARAM}=${studentId}`;
}

export function notificationsPathFor(userType: 'student' | 'teacher'): string {
  return userType === 'student'
    ? paths.studentNotifications
    : paths.teacherNotifications;
}

export function studentAdvisorPath(teacherId: number): string {
  return paths.studentAdvisor.replace(':teacherId', String(teacherId));
}

export function activityPath(
  userType: 'student' | 'teacher',
  activityId: number,
): string {
  const pattern =
    userType === 'student' ? paths.studentActivity : paths.teacherActivity;
  return pattern.replace(':activityId', String(activityId));
}

export function homePathFor(userType: UserType): string {
  const area = areas.find((candidate) => candidate.userType === userType);
  return area?.path ?? paths.home;
}
