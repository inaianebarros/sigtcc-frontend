import { useSearchParams } from 'react-router-dom';
import { PAGE_PARAM } from '../hooks/useUrlPage';
import { STUDENT_FILTER_PARAM } from '../navigation/paths';
import { positiveIntFrom } from '../navigation/positiveInt';
import type { ActivityStatus } from '../services/activityService';
import { statusFrom } from './activityStatus';

const STATUS_PARAM = 'situacao';
const OVERDUE_PARAM = 'atrasadas';
const SEARCH_PARAM = 'busca';
const STUDENT_PARAM = STUDENT_FILTER_PARAM;

export interface ActivityFilterValues {
  status: ActivityStatus | null;
  overdueOnly: boolean;
  studentId: number | null;
  search: string;
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
    search: searchParams.get(SEARCH_PARAM) ?? '',
  };
  const change = (edit: (params: URLSearchParams) => void) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      edit(params);
      return params;
    });
  // Um `aluno` que não é um id válido não filtra nada, e quem usa o tira da URL.
  const invalidStudentParam =
    canFilterByStudent &&
    searchParams.has(STUDENT_PARAM) &&
    values.studentId === null;
  return {
    ...values,
    invalidStudentParam,
    hasFilters:
      values.status !== null ||
      values.overdueOnly ||
      values.studentId !== null ||
      values.search !== '',
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
    setStudent: (studentId: number | null) =>
      change((params) =>
        studentId === null
          ? params.delete(STUDENT_PARAM)
          : params.set(STUDENT_PARAM, String(studentId)),
      ),
    setSearch: (search: string) =>
      change((params) =>
        search === ''
          ? params.delete(SEARCH_PARAM)
          : params.set(SEARCH_PARAM, search),
      ),
    clearAll: () =>
      change((params) => {
        params.delete(STATUS_PARAM);
        params.delete(OVERDUE_PARAM);
        params.delete(STUDENT_PARAM);
        params.delete(SEARCH_PARAM);
      }),
  };
}
