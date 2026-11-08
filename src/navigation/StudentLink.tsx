import { Link } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { originState } from './origin';
import { teacherStudentPath } from './paths';

/**
 * O link para o perfil de um aluno (RF11). Leva junto a lista de onde o professor veio, com a
 * página e o filtro, para o "Voltar" do perfil restaurá-los.
 */
export function StudentLink({
  studentId,
  children,
}: {
  studentId: number;
  children: ReactNode;
}) {
  const location = useLocation();
  return (
    <Link
      component={RouterLink}
      to={teacherStudentPath(studentId)}
      state={originState(location)}
    >
      {children}
    </Link>
  );
}
