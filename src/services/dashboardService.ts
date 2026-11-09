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

export interface StudentDashboard {
  hasActiveAdvising: boolean;
  advising: {
    teacher: { id: number; fullName: string };
    /** `null` enquanto o tema não foi cadastrado (RN12). */
    thesisTopic: string | null;
  } | null;
  activities: ActivityIndicators | null;
  nextActivities: { items: DashboardActivity[]; hasMore: boolean } | null;
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
}

interface ApiStudentDashboard {
  has_active_advising: boolean;
  advising: {
    teacher: { id: number; full_name: string };
    thesis_topic: string | null;
  } | null;
  activities: {
    total: number;
    pending: number;
    in_progress: number;
    in_review: number;
    completed: number;
    overdue: number;
    progress_percent: number | null;
  } | null;
  next_activities: { items: ApiActivity[]; has_more: boolean } | null;
  last_request: {
    id: number;
    status: DashboardRequestState;
    requested_at: string;
    teacher: { id: number; full_name: string };
  } | null;
  has_ended_advisings: boolean;
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
    activities: api.activities && {
      total: api.activities.total,
      pending: api.activities.pending,
      inProgress: api.activities.in_progress,
      inReview: api.activities.in_review,
      completed: api.activities.completed,
      overdue: api.activities.overdue,
      progressPercent: api.activities.progress_percent,
    },
    nextActivities: api.next_activities && {
      items: api.next_activities.items,
      hasMore: api.next_activities.has_more,
    },
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
