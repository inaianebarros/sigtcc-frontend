import { useLoad } from '../hooks/useLoad';
import type { LoadState } from '../hooks/useLoad';
import {
  listAreasOfInterest,
  listInstitutes,
} from '../services/catalogService';
import type { AreaOfInterest, Institute } from '../services/catalogService';

export interface Catalog {
  institutes: LoadState<Institute[]>;
  areas: LoadState<AreaOfInterest[]>;
  failed: boolean;
}

export function useCatalog(): Catalog {
  const institutes = useLoad(listInstitutes, 'institutes');
  const areas = useLoad(listAreasOfInterest, 'areas');
  return {
    institutes,
    areas,
    failed: institutes.status === 'error' || areas.status === 'error',
  };
}

export const CATALOG_ERROR_MESSAGE =
  'Não foi possível carregar os institutos e as áreas de interesse. Recarregue a página para tentar novamente.';

export function courseListHint(
  courses: LoadState<unknown[]>,
): string | undefined {
  if (courses.status === 'error') return 'Não foi possível carregar os cursos.';
  if (courses.status === 'loading') return 'Carregando cursos…';
  if (courses.status === 'ready' && courses.data.length === 0) {
    return 'Este instituto não tem cursos cadastrados.';
  }
  return undefined;
}
