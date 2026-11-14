import {
  Autocomplete,
  Box,
  CircularProgress,
  Paper,
  TextField,
} from '@mui/material';
import type { HTMLAttributes, SyntheticEvent } from 'react';
import { createContext, useContext, useState } from 'react';
import { useStudentFilterOptions } from './useStudentFilterOptions';
import type { StudentOption } from './useStudentFilterOptions';

/** O item "Todos", que tira o filtro; não é um aluno. */
const ALL: StudentOption = { id: 0, name: 'Todos' };
/** Quantos pixels antes do fim da lista já se pede a próxima página. */
const NEAR_END_PX = 48;
/** A partir de quantas opções antes do fim, na descida pelo teclado, já se pede a próxima página. */
const NEAR_END_OPTIONS = 3;

interface StudentFilterFieldProps {
  /** O aluno filtrado, ou `null` para Todos. */
  value: StudentOption | null;
  onChange: (student: StudentOption | null) => void;
}

/** Se mais nomes estão chegando: o Paper da lista lê daqui, sem mudar de tipo a cada leitura. */
const LoadingMoreContext = createContext(false);

/**
 * O Paper da lista, com o indicador de carregamento no fim. Precisa ser um componente estável: um
 * novo a cada renderização remontaria a lista e levaria a rolagem de volta ao início.
 */
function ListPaper(paperProps: HTMLAttributes<HTMLElement>) {
  const loadingMore = useContext(LoadingMoreContext);
  return (
    <Paper {...paperProps}>
      {paperProps.children}
      {loadingMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
          <CircularProgress
            size={24}
            aria-label="Carregando mais orientandos"
          />
        </Box>
      )}
    </Paper>
  );
}

/**
 * O filtro "Aluno" do professor: seleção única, "Todos" como padrão, busca pelo nome no servidor e
 * mais nomes conforme a rolagem chega perto do fim da lista (também pelo teclado). Com o campo
 * recém-aberto, mostra todos os orientandos, mesmo com um aluno escolhido.
 */
export function StudentFilterField({
  value,
  onChange,
}: StudentFilterFieldProps) {
  const [typed, setTyped] = useState('');
  const [opened, setOpened] = useState(false);
  const students = useStudentFilterOptions(typed, opened);

  // "Todos" só aparece sem texto digitado; o aluno escolhido, quando está fora da leva carregada,
  // entra na lista para o campo reconhecer o valor.
  const loaded = students.options;
  const withChosen =
    value && typed === '' && !loaded.some((option) => option.id === value.id)
      ? [value, ...loaded]
      : loaded;
  const options = typed === '' ? [ALL, ...withChosen] : withChosen;

  const nearEnd = (event: SyntheticEvent<HTMLElement>) => {
    const list = event.currentTarget;
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - NEAR_END_PX) {
      students.loadMore();
    }
  };

  return (
    <LoadingMoreContext value={students.loading && loaded.length > 0}>
      <Autocomplete<StudentOption, false, true, false>
        options={options}
        value={value ?? ALL}
        disableClearable
        // A busca é feita no servidor: a lista já vem filtrada.
        filterOptions={(all) => all}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, chosen) => option.id === chosen.id}
        loading={students.loading && loaded.length === 0}
        loadingText="Carregando orientandos…"
        noOptionsText="Nenhum orientando encontrado"
        onOpen={() => setOpened(true)}
        onClose={() => setTyped('')}
        onChange={(_, option) => onChange(option.id === ALL.id ? null : option)}
        // Só o que o usuário digita vira busca: o nome do valor escolhido não é busca.
        onInputChange={(_, text, reason) =>
          setTyped(reason === 'input' ? text.trim() : '')
        }
        onHighlightChange={(_, option, reason) => {
          if (reason !== 'keyboard' || !option) return;
          const index = options.findIndex((item) => item.id === option.id);
          if (index >= options.length - NEAR_END_OPTIONS) students.loadMore();
        }}
        slotProps={{ listbox: { onScroll: nearEnd } }}
        slots={{ paper: ListPaper }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Aluno"
            helperText={
              students.failed
                ? 'Não foi possível carregar os orientandos.'
                : undefined
            }
            error={students.failed}
          />
        )}
        sx={{ minWidth: { sm: 240 } }}
      />
    </LoadingMoreContext>
  );
}
