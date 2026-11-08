import type { ActivityStatus } from '../services/activityService';
import { ACTIVITY_STATUSES } from '../services/activityService';

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  in_review: 'Em revisão',
  completed: 'Concluída',
};

/** Só uma das quatro situações vale; qualquer outra coisa na URL é "Todas". */
export function statusFrom(value: string | null): ActivityStatus | null {
  return ACTIVITY_STATUSES.find((status) => status === value) ?? null;
}
