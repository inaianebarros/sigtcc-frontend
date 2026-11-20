import type {
  ActivityDetailStatus,
  ActivityStatus,
} from '../services/activityService';
import { ACTIVITY_STATUSES } from '../services/activityService';

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  in_review: 'Em revisão',
  completed: 'Concluída',
};

/** No detalhe, a atividade arquivada diz por quê: só o encerramento da orientação a arquiva (RN07). */
export const DETAIL_STATUS_LABELS: Record<ActivityDetailStatus, string> = {
  ...STATUS_LABELS,
  archived: 'Arquivada ao encerrar a orientação',
};

/**
 * A cor de cada situação nas pílulas, a mesma das contagens do cartão do orientando: só a cor do
 * contorno e do texto muda, e o rótulo em texto é o que diz a situação.
 */
export const STATUS_CHIP_COLORS: Record<
  ActivityStatus,
  'default' | 'primary' | 'secondary' | 'success'
> = {
  pending: 'default',
  in_progress: 'primary',
  in_review: 'secondary',
  completed: 'success',
};

/** Só uma das quatro situações vale; qualquer outra coisa na URL é "Todas". */
export function statusFrom(value: string | null): ActivityStatus | null {
  return ACTIVITY_STATUSES.find((status) => status === value) ?? null;
}
