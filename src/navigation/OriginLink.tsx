import { Link } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { originState } from './origin';

/**
 * O link de uma lista para um perfil (RF10 e RF11). Leva junto a lista de onde a pessoa veio, com
 * a página e os filtros, para o "Voltar" do perfil restaurá-los.
 */
export function OriginLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  const location = useLocation();
  return (
    <Link component={RouterLink} to={to} state={originState(location)}>
      {children}
    </Link>
  );
}
