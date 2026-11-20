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
  studentAdvisingReport: '/aluno/historico/:advisingId/relatorio',
  teacherAdvisingReport: '/professor/historico/:advisingId/relatorio',
  studentReportActivity:
    '/aluno/historico/:advisingId/relatorio/atividades/:activityId',
  teacherReportActivity:
    '/professor/historico/:advisingId/relatorio/atividades/:activityId',
  studentReportMeeting:
    '/aluno/historico/:advisingId/relatorio/reunioes/:meetingId',
  teacherReportMeeting:
    '/professor/historico/:advisingId/relatorio/reunioes/:meetingId',
  studentActivities: '/aluno/atividades',
  studentThesis: '/aluno/perfil#tema',
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

/** O calendário de reuniões já com só aquele orientando ligado (RN46), para o professor. */
export function teacherMeetingsOfStudentPath(studentId: number): string {
  return `${paths.teacherMeetings}?${STUDENT_FILTER_PARAM}=${studentId}`;
}

export function notificationsPathFor(userType: 'student' | 'teacher'): string {
  return userType === 'student'
    ? paths.studentNotifications
    : paths.teacherNotifications;
}

/** O relatório de uma orientação encerrada, na área de quem consulta (RF61). */
export function advisingReportPath(
  userType: 'student' | 'teacher',
  advisingId: number,
): string {
  const pattern =
    userType === 'student'
      ? paths.studentAdvisingReport
      : paths.teacherAdvisingReport;
  return pattern.replace(':advisingId', String(advisingId));
}

/** Uma atividade lida pelo relatório de uma orientação encerrada (RF61). */
export function reportActivityPath(
  userType: 'student' | 'teacher',
  advisingId: number,
  activityId: number,
): string {
  const pattern =
    userType === 'student'
      ? paths.studentReportActivity
      : paths.teacherReportActivity;
  return pattern
    .replace(':advisingId', String(advisingId))
    .replace(':activityId', String(activityId));
}

/** Uma reunião lida pelo relatório de uma orientação encerrada (RF61). */
export function reportMeetingPath(
  userType: 'student' | 'teacher',
  advisingId: number,
  meetingId: number,
): string {
  const pattern =
    userType === 'student'
      ? paths.studentReportMeeting
      : paths.teacherReportMeeting;
  return pattern
    .replace(':advisingId', String(advisingId))
    .replace(':meetingId', String(meetingId));
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
