import { useState } from 'react';
import { FilterSelect } from './FilterSelect';
import { useStudentFilterOptions } from './useStudentFilterOptions';
import type { StudentOption } from './useStudentFilterOptions';

interface StudentFilterFieldProps {
  /** O aluno filtrado, ou `null` para Todos. */
  value: StudentOption | null;
  onChange: (student: StudentOption | null) => void;
}

/**
 * O filtro "Aluno" do professor: busca pelo nome no servidor e mais nomes conforme a rolagem chega
 * perto do fim da lista (também pelo teclado).
 */
export function StudentFilterField({
  value,
  onChange,
}: StudentFilterFieldProps) {
  const [typed, setTyped] = useState('');
  const [opened, setOpened] = useState(false);
  const students = useStudentFilterOptions(typed, opened);
  const hasOptions = students.options.length > 0;

  return (
    <FilterSelect
      label="Aluno"
      allLabel="Todos"
      value={value}
      options={students.options}
      onChange={onChange}
      serverSearch
      onTyped={setTyped}
      onOpen={() => setOpened(true)}
      loading={students.loading && !hasOptions}
      loadingMoreLabel={
        students.loading && hasOptions ? 'Carregando mais orientandos' : null
      }
      loadingText="Carregando orientandos…"
      noOptionsText="Nenhum orientando encontrado"
      onNearEnd={students.loadMore}
      failedText={
        students.failed ? 'Não foi possível carregar os orientandos.' : null
      }
      minWidth={240}
    />
  );
}
