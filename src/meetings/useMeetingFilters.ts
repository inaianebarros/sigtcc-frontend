import { useSearchParams } from 'react-router-dom';
import { PAGE_PARAM } from '../hooks/useUrlPage';
import { positiveIntFrom } from '../navigation/positiveInt';
import { MEETING_SITUATIONS } from '../services/meetingService';
import type { MeetingSituation } from '../services/meetingService';

const SITUATION_PARAM = 'situacao';
const FROM_PARAM = 'de';
const TO_PARAM = 'ate';
const STUDENT_PARAM = 'aluno';

/** Só uma data real, no formato do campo (AAAA-MM-DD), vale; qualquer outra coisa é "sem data". */
function parseDateParam(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

export const RANGE_MESSAGE =
  'A data inicial não pode ser depois da data final.';

/**
 * Os filtros da lista de reuniões, guardados na URL (RNF30): recarregar ou voltar os restaura. O
 * filtro de aluno só existe para o professor. Mudar um filtro volta à primeira página.
 */
export function useMeetingFilters(canFilterByStudent: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();
  const situation =
    MEETING_SITUATIONS.find(
      (item) => item === searchParams.get(SITUATION_PARAM),
    ) ?? null;
  const from = parseDateParam(searchParams.get(FROM_PARAM));
  const to = parseDateParam(searchParams.get(TO_PARAM));
  const studentId = canFilterByStudent
    ? positiveIntFrom(searchParams.get(STUDENT_PARAM))
    : null;
  const change = (edit: (params: URLSearchParams) => void) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      edit(params);
      return params;
    });
  const setParam = (name: string, value: string | null) =>
    change((params) =>
      value === null || value === ''
        ? params.delete(name)
        : params.set(name, value),
    );
  return {
    situation,
    dateFrom: from,
    dateTo: to,
    studentId,
    /** As datas fora de ordem não consultam o servidor. */
    rangeError:
      from !== null && to !== null && from > to ? RANGE_MESSAGE : null,
    hasFilters:
      situation !== null || from !== null || to !== null || studentId !== null,
    setSituation: (value: MeetingSituation | null) =>
      setParam(SITUATION_PARAM, value),
    setDateFrom: (value: string) => setParam(FROM_PARAM, value),
    setDateTo: (value: string) => setParam(TO_PARAM, value),
    setStudent: (id: number | null) =>
      setParam(STUDENT_PARAM, id === null ? null : String(id)),
    clearAll: () =>
      change((params) => {
        for (const name of [
          SITUATION_PARAM,
          FROM_PARAM,
          TO_PARAM,
          STUDENT_PARAM,
        ])
          params.delete(name);
      }),
  };
}
