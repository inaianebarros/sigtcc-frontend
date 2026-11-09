import { httpClient } from './httpClient';

export const ACTIVITIES_PAGE_SIZE = 20;

export const ACTIVITY_STATUSES = [
  'pending',
  'in_progress',
  'in_review',
  'completed',
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export interface ActivityItem {
  id: number;
  title: string;
  /** Data sem hora, como o servidor a devolve (AAAA-MM-DD). */
  deadline: string;
  status: ActivityStatus;
  /** Calculado pelo servidor (RN24): a tela nunca decide se está atrasada. */
  overdue: boolean;
  student: { id: number; fullName: string };
}

export interface ActivityPage {
  items: ActivityItem[];
  count: number;
}

export interface SubmissionFile {
  id: number;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

export interface Submission {
  id: number;
  submittedAt: string;
  files: SubmissionFile[];
}

export interface Review {
  id: number;
  decision: 'accepted' | 'rejected';
  decidedAt: string;
}

export interface ActivityDetail extends ActivityItem {
  description: string;
  createdAt: string;
  /** O orientador da atividade, quando o servidor o informa (#111). */
  teacher: { id: number; fullName: string } | null;
  submissions: Submission[];
  reviews: Review[];
  commentsCount: number;
}

export interface ActivityFilters {
  page: number;
  status: ActivityStatus | null;
  overdueOnly: boolean;
  studentId: number | null;
}

export interface ActivityInput {
  title: string;
  description: string;
  deadline: string;
}

interface ApiItem {
  id: number;
  title: string;
  deadline: string;
  status: ActivityStatus;
  overdue: boolean;
  student: { id: number; full_name: string };
}

interface ApiDetail extends ApiItem {
  description: string;
  created_at: string;
  teacher?: { id: number; full_name: string } | null;
  submissions: {
    id: number;
    submitted_at: string;
    files: {
      id: number;
      file_name: string;
      size_bytes: number;
      content_type: string;
    }[];
  }[];
  reviews: {
    id: number;
    decision: 'accepted' | 'rejected';
    decided_at: string;
  }[];
  comments_count: number;
}

function itemFrom(item: ApiItem): ActivityItem {
  return {
    id: item.id,
    title: item.title,
    deadline: item.deadline,
    status: item.status,
    overdue: item.overdue,
    student: { id: item.student.id, fullName: item.student.full_name },
  };
}

function detailFrom(detail: ApiDetail): ActivityDetail {
  return {
    ...itemFrom(detail),
    description: detail.description,
    createdAt: detail.created_at,
    teacher: detail.teacher
      ? { id: detail.teacher.id, fullName: detail.teacher.full_name }
      : null,
    submissions: detail.submissions.map((submission) => ({
      id: submission.id,
      submittedAt: submission.submitted_at,
      files: submission.files.map((file) => ({
        id: file.id,
        fileName: file.file_name,
        sizeBytes: file.size_bytes,
        contentType: file.content_type,
      })),
    })),
    reviews: detail.reviews.map((review) => ({
      id: review.id,
      decision: review.decision,
      decidedAt: review.decided_at,
    })),
    commentsCount: detail.comments_count,
  };
}

export async function listActivities(
  filters: ActivityFilters,
): Promise<ActivityPage> {
  const params = new URLSearchParams({
    limit: String(ACTIVITIES_PAGE_SIZE),
    offset: String((filters.page - 1) * ACTIVITIES_PAGE_SIZE),
  });
  if (filters.status) params.set('status', filters.status);
  if (filters.overdueOnly) params.set('overdue', 'true');
  if (filters.studentId !== null)
    params.set('student_id', String(filters.studentId));
  const response = await httpClient.get<{ items: ApiItem[]; count: number }>(
    `/atividades?${params}`,
  );
  return { count: response.count, items: response.items.map(itemFrom) };
}

export async function getActivity(id: number): Promise<ActivityDetail> {
  return detailFrom(await httpClient.get<ApiDetail>(`/atividades/${id}`));
}

/** O professor cria a atividade para um orientando (RF25); o servidor valida e decide. */
export async function createActivity(
  studentId: number,
  input: ActivityInput,
): Promise<void> {
  await httpClient.post('/atividades', { student_id: studentId, ...input });
}

/** Edição parcial: só os campos que mudaram são enviados (RF26). */
export async function updateActivity(
  id: number,
  changes: Partial<ActivityInput>,
): Promise<void> {
  await httpClient.patch(`/atividades/${id}`, changes);
}

/** O conteúdo de um arquivo de uma Entrega, por requisição autenticada (RF31). */
export function downloadSubmissionFile(
  activityId: number,
  fileId: number,
): Promise<Blob> {
  return httpClient.download(`/atividades/${activityId}/arquivos/${fileId}`);
}

/** A Entrega de 1 a 5 arquivos (RF31), com o progresso do envio de 0 a 100. */
export async function submitDelivery(
  activityId: number,
  files: File[],
  onProgress: (percent: number) => void,
): Promise<void> {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  await httpClient.upload(
    `/atividades/${activityId}/entregas`,
    form,
    onProgress,
  );
}

export type StudentRequestedStatus = 'pending' | 'in_progress' | 'in_review';

/** O aluno alterna entre pendente e em andamento ou envia para revisão (RF28, RN15). */
export async function changeActivityStatus(
  id: number,
  status: StudentRequestedStatus,
): Promise<void> {
  await httpClient.patch(`/atividades/${id}/status`, { status });
}

/** Exclusão lógica (RF27): o servidor preserva entregas, revisões e comentários. */
export async function deleteActivity(id: number): Promise<void> {
  await httpClient.delete(`/atividades/${id}`);
}
