import { httpClient } from './httpClient';
import type { ActivityStatus } from './activityService';

/** Uma atividade das listas da Dashboard; o atraso é calculado pelo servidor (RN24, RN37). */
export interface DashboardActivity {
  id: number;
  title: string;
  /** Data sem hora, como o servidor a devolve (AAAA-MM-DD). */
  deadline: string;
  status: ActivityStatus;
  overdue: boolean;
  /** O orientando da atividade, nas listas do professor. */
  student?: { id: number; fullName: string };
}

/** Os números das atividades da orientação ativa (RN35). O percentual é `null` sem atividades. */
export interface ActivityIndicators {
  total: number;
  pending: number;
  inProgress: number;
  inReview: number;
  completed: number;
  overdue: number;
  progressPercent: number | null;
}

export type DashboardRequestState = 'pending' | 'rejected' | 'unanswered';

/**
 * Uma reunião aceita e futura de uma Dashboard (RF50, RF51): o horário com o fuso, o outro
 * participante (o professor, para o aluno; o orientando, para o professor) e a descrição já
 * resumida pelo servidor.
 */
export interface DashboardMeeting {
  id: number;
  scheduledAt: string;
  partyName: string;
  description: string;
}

export interface DashboardMeetings {
  items: DashboardMeeting[];
  hasMore: boolean;
}

export interface StudentDashboard {
  hasActiveAdvising: boolean;
  advising: {
    teacher: { id: number; fullName: string };
    /** `null` enquanto o tema não foi cadastrado (RN12). */
    thesisTopic: string | null;
  } | null;
  activities: ActivityIndicators | null;
  nextActivities: { items: DashboardActivity[]; hasMore: boolean } | null;
  /** `null` sem orientação ativa. */
  nextMeetings: DashboardMeetings | null;
  /** A última solicitação, se ainda está pendente, recusada ou não respondida (RN20). */
  lastRequest: {
    id: number;
    status: DashboardRequestState;
    requestedAt: string;
    teacher: { id: number; fullName: string };
  } | null;
  hasEndedAdvisings: boolean;
}

interface ApiActivity {
  id: number;
  title: string;
  deadline: string;
  status: ActivityStatus;
  overdue: boolean;
  student?: { id: number; full_name: string };
}

interface ApiMeeting {
  id: number;
  scheduled_at: string;
  description: string;
}

/** Na Dashboard do aluno o outro participante é o professor. */
interface ApiStudentMeeting extends ApiMeeting {
  teacher: { id: number; full_name: string };
}

/** Na Dashboard do professor o outro participante é o orientando. */
interface ApiTeacherMeeting extends ApiMeeting {
  student: { id: number; full_name: string };
}

function meetingFrom(meeting: ApiMeeting, partyName: string): DashboardMeeting {
  return {
    id: meeting.id,
    scheduledAt: meeting.scheduled_at,
    partyName,
    description: meeting.description,
  };
}

function studentMeetingsFrom(
  api: { items: ApiStudentMeeting[]; has_more: boolean } | null | undefined,
): DashboardMeetings | null {
  if (!api) return null;
  return {
    items: api.items.map((meeting) =>
      meetingFrom(meeting, meeting.teacher.full_name),
    ),
    hasMore: api.has_more,
  };
}

function teacherMeetingsFrom(
  api: { items: ApiTeacherMeeting[]; has_more: boolean } | null | undefined,
): DashboardMeetings | null {
  if (!api) return null;
  return {
    items: api.items.map((meeting) =>
      meetingFrom(meeting, meeting.student.full_name),
    ),
    hasMore: api.has_more,
  };
}

interface ApiIndicators {
  total: number;
  pending: number;
  in_progress: number;
  in_review: number;
  completed: number;
  overdue: number;
  progress_percent: number | null;
}

interface ApiStudentDashboard {
  has_active_advising: boolean;
  advising: {
    teacher: { id: number; full_name: string };
    thesis_topic: string | null;
  } | null;
  activities: ApiIndicators | null;
  next_activities: { items: ApiActivity[]; has_more: boolean } | null;
  next_meetings: {
    items: ApiStudentMeeting[];
    has_more: boolean;
  } | null;
  last_request: {
    id: number;
    status: DashboardRequestState;
    requested_at: string;
    teacher: { id: number; full_name: string };
  } | null;
  has_ended_advisings: boolean;
}

function indicatorsFrom(api: ApiIndicators): ActivityIndicators {
  return {
    total: api.total,
    pending: api.pending,
    inProgress: api.in_progress,
    inReview: api.in_review,
    completed: api.completed,
    overdue: api.overdue,
    progressPercent: api.progress_percent,
  };
}

function activityFrom(activity: ApiActivity): DashboardActivity {
  return {
    id: activity.id,
    title: activity.title,
    deadline: activity.deadline,
    status: activity.status,
    overdue: activity.overdue,
    ...(activity.student && {
      student: {
        id: activity.student.id,
        fullName: activity.student.full_name,
      },
    }),
  };
}

function dashboardFrom(api: ApiStudentDashboard): StudentDashboard {
  return {
    hasActiveAdvising: api.has_active_advising,
    advising: api.advising && {
      teacher: {
        id: api.advising.teacher.id,
        fullName: api.advising.teacher.full_name,
      },
      thesisTopic: api.advising.thesis_topic,
    },
    activities: api.activities && indicatorsFrom(api.activities),
    nextActivities: api.next_activities && {
      items: api.next_activities.items.map(activityFrom),
      hasMore: api.next_activities.has_more,
    },
    nextMeetings: studentMeetingsFrom(api.next_meetings),
    lastRequest: api.last_request && {
      id: api.last_request.id,
      status: api.last_request.status,
      requestedAt: api.last_request.requested_at,
      teacher: {
        id: api.last_request.teacher.id,
        fullName: api.last_request.teacher.full_name,
      },
    },
    hasEndedAdvisings: api.has_ended_advisings,
  };
}

/** A Dashboard do aluno (RF50): tudo vem calculado do servidor, a tela só mostra. */
export async function getStudentDashboard(): Promise<StudentDashboard> {
  return dashboardFrom(
    await httpClient.get<ApiStudentDashboard>('/painel/aluno'),
  );
}

/** Um orientando que precisa de atenção (RN38), na ordem em que o servidor o classificou. */
export interface AttentionAdvisee {
  id: number;
  fullName: string;
  /** `null` enquanto o tema não foi cadastrado (RN12). */
  thesisTopic: string | null;
  overdueCount: number;
  inReviewCount: number;
}

export interface TeacherDashboard {
  adviseesCount: number;
  /** `null` sem orientações ativas: a resposta vazia, sem indicadores. */
  activities: ActivityIndicators | null;
  attentionAdvisees: { items: AttentionAdvisee[]; hasMore: boolean } | null;
  nextDeadlines: { items: DashboardActivity[]; hasMore: boolean } | null;
  /** `null` sem orientações ativas. */
  nextMeetings: DashboardMeetings | null;
}

interface ApiTeacherDashboard {
  advisees_count: number;
  activities: ApiIndicators | null;
  attention_advisees: {
    items: {
      id: number;
      full_name: string;
      thesis_topic: string | null;
      overdue_count: number;
      in_review_count: number;
    }[];
    has_more: boolean;
  } | null;
  next_deadlines: { items: ApiActivity[]; has_more: boolean } | null;
  next_meetings: {
    items: ApiTeacherMeeting[];
    has_more: boolean;
  } | null;
}

function teacherDashboardFrom(api: ApiTeacherDashboard): TeacherDashboard {
  return {
    adviseesCount: api.advisees_count,
    activities: api.activities && indicatorsFrom(api.activities),
    attentionAdvisees: api.attention_advisees && {
      items: api.attention_advisees.items.map((item) => ({
        id: item.id,
        fullName: item.full_name,
        thesisTopic: item.thesis_topic,
        overdueCount: item.overdue_count,
        inReviewCount: item.in_review_count,
      })),
      hasMore: api.attention_advisees.has_more,
    },
    nextDeadlines: api.next_deadlines && {
      items: api.next_deadlines.items.map(activityFrom),
      hasMore: api.next_deadlines.has_more,
    },
    nextMeetings: teacherMeetingsFrom(api.next_meetings),
  };
}

/** A Dashboard do professor (RF51): tudo vem calculado do servidor, a tela só mostra. */
export async function getTeacherDashboard(): Promise<TeacherDashboard> {
  return teacherDashboardFrom(
    await httpClient.get<ApiTeacherDashboard>('/painel/professor'),
  );
}
