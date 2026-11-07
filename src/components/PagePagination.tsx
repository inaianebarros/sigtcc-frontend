import { Pagination } from '@mui/material';

function pageLabel(
  type: string,
  page: number | null,
  selected: boolean,
): string {
  if (type === 'page') {
    return selected ? `Página ${page}, atual` : `Ir para a página ${page}`;
  }
  if (type === 'first') return 'Ir para a primeira página';
  if (type === 'last') return 'Ir para a última página';
  if (type === 'next') return 'Ir para a próxima página';
  return 'Ir para a página anterior';
}

interface PagePaginationProps {
  ariaLabel: string;
  knownCount: number;
  pageSize: number;
  lastPage: number;
  page: number;
  onChange: (page: number) => void;
}

/** A navegação numerada, em português; só aparece quando a lista não cabe em uma página. */
export function PagePagination({
  ariaLabel,
  knownCount,
  pageSize,
  lastPage,
  page,
  onChange,
}: PagePaginationProps) {
  if (knownCount <= pageSize) return null;
  return (
    <Pagination
      aria-label={ariaLabel}
      count={lastPage}
      page={Math.min(page, lastPage)}
      getItemAriaLabel={pageLabel}
      onChange={(_, value) => onChange(value)}
      sx={{ alignSelf: 'center' }}
    />
  );
}
