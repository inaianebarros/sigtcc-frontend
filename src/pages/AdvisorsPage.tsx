import {
  Alert,
  Button,
  FormControlLabel,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdvisorCard } from '../advisors/AdvisorCard';
import { EligibilityNotice } from '../advisors/EligibilityNotice';
import { RequestAdvisingDialog } from '../advisors/RequestAdvisingDialog';
import { useRequestAdvising } from '../advisors/useRequestAdvising';
import { PagePagination } from '../components/PagePagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import {
  PAGE_PARAM,
  useReturnToLastPage,
  useUrlPage,
} from '../hooks/useUrlPage';
import { ADVISORS_PAGE_SIZE, searchAdvisors } from '../services/advisorService';
import type { AdvisorPage } from '../services/advisorService';

const SEARCH_DEBOUNCE_MS = 400;
const NAME_PARAM = 'nome';
const SHOW_ALL_PARAM = 'show_all';

function ListSkeleton() {
  return (
    <Stack spacing={2} data-testid="advisors-skeleton" aria-hidden>
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} variant="rounded" height={140} />
      ))}
    </Stack>
  );
}

function foundText(count: number, showAll: boolean): string {
  const one = count === 1;
  if (showAll) {
    return `${count} ${one ? 'professor encontrado' : 'professores encontrados'}`;
  }
  return `${count} ${one ? 'professor com áreas em comum encontrado' : 'professores com áreas em comum encontrados'}`;
}

function emptyMessage(name: string, showAll: boolean): string {
  if (showAll) {
    return name
      ? `Nenhum professor encontrado para “${name}”.`
      : 'Ainda não há professores cadastrados para o seu curso.';
  }
  return name
    ? `Nenhum professor com áreas em comum encontrado para “${name}”.`
    : 'Nenhum professor do seu curso tem áreas em comum com as suas.';
}

export function AdvisorsPage() {
  // Cada carga tem o seu contador: refazer a elegibilidade não recarrega a lista, e vice-versa.
  const [listReload, setListReload] = useState(0);
  // O nome, a chave e a página vivem na URL (?nome=, ?show_all=true e ?pagina=): recarregar ou
  // voltar do perfil de um professor restaura a mesma lista. Um filtro novo apaga a página, e a
  // chave não é guardada entre visitas: sem parâmetros, cada visita começa pelo padrão.
  const [searchParams, setSearchParams] = useSearchParams();
  const name = (searchParams.get(NAME_PARAM) ?? '').trim();
  const showAll = searchParams.get(SHOW_ALL_PARAM) === 'true';
  const [page, setPage] = useUrlPage();
  const [typed, setTyped] = useState(name);
  const debounced = useDebouncedValue(typed, SEARCH_DEBOUNCE_MS).trim();
  // Um nome que mudou por fora, como num link para a lista, passa para o campo.
  const [seenName, setSeenName] = useState(name);
  if (name !== seenName) {
    setSeenName(name);
    if (name !== typed.trim()) setTyped(name);
  }
  // Só a digitação que assentou vai para a URL, sem entrar no histórico: assim uma mudança que
  // veio da URL não é desfeita enquanto a pausa da digitação ainda corre.
  useEffect(() => {
    if (debounced !== typed.trim() || debounced === name) return;
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete(PAGE_PARAM);
        if (debounced) params.set(NAME_PARAM, debounced);
        else params.delete(NAME_PARAM);
        return params;
      },
      { replace: true },
    );
  }, [debounced, typed, name, setSearchParams]);
  const chooseShowAll = (next: boolean) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      if (next) params.set(SHOW_ALL_PARAM, 'true');
      else params.delete(SHOW_ALL_PARAM);
      return params;
    });
  const switchInput = useRef<HTMLInputElement>(null);
  const listTop = useRef<HTMLDivElement>(null);
  // A solicitação de orientação é a mesma do perfil do professor; um 409 relê a lista também.
  const request = useRequestAdvising({
    onConflict: () => setListReload((current) => current + 1),
  });
  const list = useLoad<AdvisorPage>(
    () => searchAdvisors({ name, page, showAll }),
    `${name}|${showAll}|${page}|${listReload}`,
  );
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    ADVISORS_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Orientadores
      </Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <TextField
          label="Buscar por nome"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 150 } }}
          sx={{ flexGrow: 1 }}
        />
        <FormControlLabel
          label="Mostrar todos"
          control={
            <Switch
              checked={showAll}
              onChange={(event) => chooseShowAll(event.target.checked)}
              slotProps={{ input: { ref: switchInput } }}
            />
          }
        />
      </Stack>
      <EligibilityNotice {...request.notice} />
      {/* Uma frase curta numa região própria: reler os 20 cards a cada busca seria ruído. */}
      <Typography role="status" aria-live="polite" color="text.secondary">
        {list.status === 'ready' && list.data.count > 0
          ? foundText(list.data.count, showAll)
          : ''}
      </Typography>
      <div ref={listTop}>
        {list.status === 'loading' && <ListSkeleton />}
        {list.status === 'error' && (
          <Stack spacing={2}>
            <Alert severity="error">{list.message}</Alert>
            <Button
              onClick={() => setListReload((current) => current + 1)}
              sx={{ alignSelf: 'flex-start' }}
            >
              Tentar novamente
            </Button>
          </Stack>
        )}
        {list.status === 'ready' && list.data.count === 0 && (
          <Alert
            severity="info"
            action={
              showAll ? undefined : (
                <Button
                  onClick={() => {
                    chooseShowAll(true);
                    // O alerta some ao recarregar: o foco vai para a chave, que anuncia o novo estado.
                    switchInput.current?.focus();
                  }}
                >
                  Ver todos os professores do curso
                </Button>
              )
            }
          >
            {emptyMessage(name, showAll)}
          </Alert>
        )}
        {list.status === 'ready' && list.data.items.length > 0 && (
          <Stack spacing={2}>
            {list.data.items.map((advisor) => (
              <AdvisorCard
                key={advisor.id}
                advisor={advisor}
                {...request.requesting}
              />
            ))}
          </Stack>
        )}
      </div>
      <PagePagination
        ariaLabel="Paginação dos orientadores"
        knownCount={knownCount}
        pageSize={ADVISORS_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={(next) => {
          setPage(next);
          listTop.current?.scrollIntoView?.({ block: 'start' });
        }}
      />
      <RequestAdvisingDialog {...request.dialog} />
    </Stack>
  );
}
