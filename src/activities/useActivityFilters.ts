import { useSearchParams } from 'react-router-dom';
import { PAGE_PARAM } from '../hooks/useUrlPage';
import { STUDENT_FILTER_PARAM } from '../navigation/paths';
import { positiveIntFrom } from '../navigation/positiveInt';
import type { ActivityStatus } from '../services/activityService';
import { statusFrom } from './activityStatus';

const STATUS_PARAM = 'situacao';
const OVERDUE_PARAM = 'atrasadas';
const STUDENT_PARAM = STUDENT_FILTER_PARAM;

export interface ActivityFilterValues {
  status: ActivityStatus | null;
  overdueOnly: boolean;
  studentId: number | null;
}

/**
 * Os filtros da lista de atividades, guardados na URL (RNF30): recarregar ou voltar do detalhe os
 * restaura. O filtro de aluno só existe para o professor. Mudar um filtro volta à primeira página.
 */
export function useActivityFilters(canFilterByStudent: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();
  const values: ActivityFilterValues = {
    status: statusFrom(searchParams.get(STATUS_PARAM)),
    overdueOnly: searchParams.get(OVERDUE_PARAM) === '1',
    studentId: canFilterByStudent
      ? positiveIntFrom(searchParams.get(STUDENT_PARAM))
      : null,
  };
  const change = (edit: (params: URLSearchParams) => void) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      edit(params);
      return params;
    });
  return {
    ...values,
    hasFilters:
      values.status !== null || values.overdueOnly || values.studentId !== null,
    setStatus: (status: ActivityStatus | null) =>
      change((params) =>
        status === null
          ? params.delete(STATUS_PARAM)
          : params.set(STATUS_PARAM, status),
      ),
    setOverdueOnly: (on: boolean) =>
      change((params) =>
        on ? params.set(OVERDUE_PARAM, '1') : params.delete(OVERDUE_PARAM),
      ),
    clearStudent: () => change((params) => params.delete(STUDENT_PARAM)),
    clearAll: () =>
      change((params) => {
        params.delete(STATUS_PARAM);
        params.delete(OVERDUE_PARAM);
        params.delete(STUDENT_PARAM);
      }),
  };
}
