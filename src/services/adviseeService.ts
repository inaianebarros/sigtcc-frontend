import { httpClient } from './httpClient';

export const ADVISEES_PAGE_SIZE = 20;

export interface Advisee {
  advisingId: number;
  student: {
    id: number;
    fullName: string;
    course: { id: number; name: string };
  };
  startedAt: string;
  /** `null` quando ainda não há tema cadastrado. */
  thesisTopic: string | null;
  activities: {
    pending: number;
    inProgress: number;
    inReview: number;
    completed: number;
  };
}

export interface AdviseePage {
  items: Advisee[];
  count: number;
}

interface ApiAdvisee {
  advising_id: number;
  student: {
    id: number;
    full_name: string;
    course: { id: number; name: string };
  };
  started_at: string;
  thesis_topic: string | null;
  activities: {
    pending: number;
    in_progress: number;
    in_review: number;
    completed: number;
  };
}

export async function listAdvisees(page: number): Promise<AdviseePage> {
  const params = new URLSearchParams({
    limit: String(ADVISEES_PAGE_SIZE),
    offset: String((page - 1) * ADVISEES_PAGE_SIZE),
  });
  const response = await httpClient.get<{ items: ApiAdvisee[]; count: number }>(
    `/orientacao/orientandos?${params}`,
  );
  return {
    count: response.count,
    items: response.items.map((item) => ({
      advisingId: item.advising_id,
      student: {
        id: item.student.id,
        fullName: item.student.full_name,
        course: item.student.course,
      },
      startedAt: item.started_at,
      thesisTopic: item.thesis_topic,
      activities: {
        pending: item.activities.pending,
        inProgress: item.activities.in_progress,
        inReview: item.activities.in_review,
        completed: item.activities.completed,
      },
    })),
  };
}
