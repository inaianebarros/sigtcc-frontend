import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLoad } from '../../hooks/useLoad';
import { STUDENT_FILTER_PARAM } from '../../navigation/paths';
import { positiveIntFrom } from '../../navigation/positiveInt';
import { listAllCalendarAdviseeIds } from '../../services/meetingService';

export interface EntryStudentFilter {
  /** O orientando do "Ver reuniões" ainda está sendo conferido: o calendário espera. */
  pending: boolean;
  /**
   * Os orientandos a desligar para deixar só o da URL ligado, ou `null` quando não há filtro de
   * entrada: sem parâmetro, com um inválido, fora do painel ou com a lista do painel em falha.
   */
  hiddenStudentIds: ReadonlySet<number> | null;
}

async function othersThan(studentId: number): Promise<Set<number> | null> {
  const ids = await listAllCalendarAdviseeIds();
  if (!ids.includes(studentId)) return null;
  return new Set(ids.filter((id) => id !== studentId));
}

/**
 * O filtro de entrada do calendário do professor (RN46): o "Ver reuniões" da lista de orientandos
 * abre o calendário com `?aluno=` e só aquele orientando ligado. O parâmetro é lido uma vez, ao
 * abrir, e nunca regravado; o aluno logado não tem painel de orientandos e o ignora.
 */
export function useEntryStudent(isTeacher: boolean): EntryStudentFilter {
  const [searchParams] = useSearchParams();
  const [studentId] = useState(() =>
    isTeacher ? positiveIntFrom(searchParams.get(STUDENT_FILTER_PARAM)) : null,
  );
  const load = useLoad(
    () => (studentId === null ? Promise.resolve(null) : othersThan(studentId)),
    studentId === null ? null : `${studentId}`,
  );
  return {
    pending:
      studentId !== null &&
      (load.status === 'idle' || load.status === 'loading'),
    hiddenStudentIds: load.status === 'ready' ? load.data : null,
  };
}
