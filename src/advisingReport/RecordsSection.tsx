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
const TYPE_TITLES: Record<RecordType | 'all', string> = {
  all: 'Todos os registros',
  meeting: 'Reuniões',
  activity: 'Atividades',
};

/** Só "reunioes" ou "atividades" valem; qualquer outra coisa na URL é "Todos". */
function typeFrom(value: string | null): RecordType | null {
  const found = Object.entries(TYPE_URL_VALUES).find(
    ([, url]) => url === value,
  );
  return (found?.[0] as RecordType | undefined) ?? null;
}

function countText(count: number): string {
  return `${count} ${count === 1 ? 'registro' : 'registros'}`;
}

/**
 * O "Histórico de acontecimentos" do relatório (RF61): os registros da orientação, filtrados por
 * tipo e paginados. O tipo e a página ficam na URL (RNF30); mudar o tipo volta à primeira página.
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
        Histórico de acontecimentos
      </Typography>
      <Stack spacing={1}>
        <Typography
          variant="body2"
          color="text.secondary"
          id="record-type-label"
        >
          Tipo de registro
        </Typography>
        <RecordTypeFilter value={type} onChange={changeType} />
      </Stack>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2 }}
      >
        <Typography variant="h6" component="h3">
          {TYPE_TITLES[type ?? 'all']}
        </Typography>
        {/* A região existe desde o início, para a mudança da quantidade ser anunciada. */}
        <span role="status" aria-live="polite">
          {list.status === 'ready' && (
            <Chip label={countText(list.data.count)} size="small" />
          )}
        </span>
      </Stack>
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
          Esta orientação não tem registros. As reuniões realizadas e as
          atividades concluídas ou arquivadas aparecem aqui.
        </Alert>
      )}
      {list.status === 'ready' && list.data.count === 0 && type !== null && (
        <Stack spacing={2}>
          <Alert severity="info">
            Nenhum registro deste tipo nesta orientação. Escolha outro tipo de
            registro.
          </Alert>
          <Button
            onClick={() => changeType(null)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Ver todos os registros
          </Button>
        </Stack>
      )}
      {list.status === 'ready' && list.data.items.length > 0 && (
        <Stack spacing={2}>
          {list.data.items.map((record) => (
            <RecordCard key={`${record.type}-${record.id}`} record={record} />
          ))}
        </Stack>
      )}
      <PagePagination
        ariaLabel="Paginação dos registros"
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
