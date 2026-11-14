import { Chip, Skeleton, Stack, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { RecordCard } from './RecordCard';
import { RecordTypeFilter } from './RecordTypeFilter';
import { useLoad } from '../hooks/useLoad';
import { PAGE_PARAM, useUrlPage } from '../hooks/useUrlPage';
import {
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
  const [page] = useUrlPage();
  const list = useLoad(
    () => listAdvisingRecords(advisingId, page, type ?? undefined),
    `${advisingId}|${type}|${page}`,
  );

  const changeType = (next: RecordType | null) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      if (next === null) params.delete(TYPE_PARAM);
      else params.set(TYPE_PARAM, TYPE_URL_VALUES[next]);
      return params;
    });

  return (
    <Stack spacing={2} component="section">
      <Typography variant="h5" component="h2">
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
        {list.status === 'ready' && (
          <Chip label={countText(list.data.count)} size="small" />
        )}
      </Stack>
      {list.status === 'loading' && (
        <Skeleton variant="rounded" height={140} aria-hidden />
      )}
      {list.status === 'ready' && (
        <Stack spacing={2}>
          {list.data.items.map((record) => (
            <RecordCard key={`${record.type}-${record.id}`} record={record} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
