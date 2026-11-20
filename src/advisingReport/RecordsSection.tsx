import {
  Alert,
  Button,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PagePagination } from '../components/PagePagination';
import { usePageBounds } from '../hooks/usePageBounds';
import { RecordCard } from './RecordCard';
import { RecordTypeFilter } from './RecordTypeFilter';
import { useLoad } from '../hooks/useLoad';
import {
  PAGE_PARAM,
  useReturnToLastPage,
  useUrlPage,
} from '../hooks/useUrlPage';
import {
  RECORDS_PAGE_SIZE,
  listAdvisingRecords,
  type RecordType,
} from '../services/advisingRecordsService';

const TYPE_PARAM = 'tipo';
const TYPE_URL_VALUES: Record<RecordType, string> = {
  meeting: 'reunioes',
  activity: 'atividades',
};

/** Só "reunioes" ou "atividades" valem; qualquer outra coisa na URL é "Todos". */
function typeFrom(value: string | null): RecordType | null {
  const found = Object.entries(TYPE_URL_VALUES).find(
    ([, url]) => url === value,
  );
  return (found?.[0] as RecordType | undefined) ?? null;
}

function countText(count: number, type: RecordType | null): string {
  const singular = count === 1;
  if (type === 'meeting')
    return `${count} ${singular ? 'reunião' : 'reuniões'}`;
  if (type === 'activity') {
    return `${count} ${singular ? 'atividade' : 'atividades'}`;
  }
  return `${count} ${singular ? 'item' : 'itens'}`;
}

/**
 * A lista "Reuniões e atividades da orientação" do relatório (RF61): as reuniões realizadas e as
 * atividades concluídas ou arquivadas, filtradas por tipo e paginadas. O filtro e a página ficam na URL (RNF30); mudar o tipo volta à primeira página.
 */
export function RecordsSection({ advisingId }: { advisingId: number }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = typeFrom(searchParams.get(TYPE_PARAM));
  const [page, setPage] = useUrlPage();
  const listTop = useRef<HTMLDivElement>(null);
  const [reload, setReload] = useState(0);
  const headingId = useId();
  const list = useLoad(
    () => listAdvisingRecords(advisingId, page, type ?? undefined),
    `${advisingId}|${type}|${page}|${reload}`,
  );

  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    RECORDS_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);

  const changeType = (next: RecordType | null) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      if (next === null) params.delete(TYPE_PARAM);
      else params.set(TYPE_PARAM, TYPE_URL_VALUES[next]);
      return params;
    });

  return (
    <Stack
      ref={listTop}
      spacing={2}
      component="section"
      aria-labelledby={headingId}
    >
      <Typography id={headingId} variant="h5" component="h2">
        Reuniões e atividades da orientação
      </Typography>
      <Stack>
        <Typography color="text.secondary">
          Reuniões que aconteceram e atividades concluídas ou arquivadas, da
          mais recente para a mais antiga.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Reuniões canceladas e atividades excluídas não aparecem.
        </Typography>
      </Stack>
      <Stack spacing={1}>
        <Typography
          variant="body2"
          color="text.secondary"
          id="record-type-label"
        >
          Mostrar
        </Typography>
        <RecordTypeFilter value={type} onChange={changeType} />
      </Stack>
      {/* A região existe desde o início, para a mudança da quantidade ser anunciada. */}
      <span role="status" aria-live="polite">
        {list.status === 'ready' && (
          <Chip label={countText(list.data.count, type)} size="small" />
        )}
      </span>
      {list.status === 'loading' && (
        <Stack spacing={2} data-testid="records-skeleton" aria-hidden>
          {[0, 1].map((item) => (
            <Skeleton key={item} variant="rounded" height={140} />
          ))}
        </Stack>
      )}
      {list.status === 'error' && (
        <Stack spacing={2}>
          <Alert severity="error">{list.message}</Alert>
          <Button
            onClick={() => setReload((current) => current + 1)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Tentar novamente
          </Button>
        </Stack>
      )}
      {list.status === 'ready' && list.data.count === 0 && type === null && (
        <Alert severity="info">
          Esta orientação não tem reunião realizada nem atividade concluída ou
          arquivada.
        </Alert>
      )}
      {list.status === 'ready' && list.data.count === 0 && type !== null && (
        <Stack spacing={2}>
          <Alert severity="info">
            {type === 'meeting'
              ? 'Nenhuma reunião foi realizada nesta orientação.'
              : 'Nenhuma atividade foi concluída ou arquivada nesta orientação.'}
          </Alert>
          <Button
            onClick={() => changeType(null)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Ver reuniões e atividades
          </Button>
        </Stack>
      )}
      {list.status === 'ready' && list.data.items.length > 0 && (
        <Stack spacing={2}>
          {list.data.items.map((record) => (
            <RecordCard
              key={`${record.type}-${record.id}`}
              advisingId={advisingId}
              record={record}
            />
          ))}
        </Stack>
      )}
      <PagePagination
        ariaLabel="Paginação da lista de reuniões e atividades"
        knownCount={knownCount}
        pageSize={RECORDS_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={(next) => {
          setPage(next);
          listTop.current?.scrollIntoView?.({ block: 'start' });
        }}
      />
    </Stack>
  );
}
