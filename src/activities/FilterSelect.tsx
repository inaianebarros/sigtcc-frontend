import {
  Autocomplete,
  Box,
  CircularProgress,
  Paper,
  TextField,
} from '@mui/material';
import type { HTMLAttributes, SyntheticEvent } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

export interface FilterOption {
  id: number | string;
  name: string;
}

/** Quantos pixels antes do fim da lista já se pede a próxima página. */
const NEAR_END_PX = 48;
/** A partir de quantas opções antes do fim, na descida pelo teclado, já se pede a próxima página. */
const NEAR_END_OPTIONS = 3;
/** O id do item "Todos"/"Todas", que tira o filtro; nenhum filtro tem uma opção com este id. */
const ALL_ID = '__all__';

/** Se mais itens estão chegando: o Paper da lista lê daqui, sem mudar de tipo a cada leitura. */
const LoadingMoreContext = createContext<string | null>(null);

/**
 * O Paper da lista, com o indicador de carregamento no fim. Precisa ser um componente estável: um
 * novo a cada renderização remontaria a lista e levaria a rolagem de volta ao início.
 */
function ListPaper(paperProps: HTMLAttributes<HTMLElement>) {
  const loadingMoreLabel = useContext(LoadingMoreContext);
  return (
    <Paper {...paperProps}>
      {paperProps.children}
      {loadingMoreLabel !== null && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
          <CircularProgress size={24} aria-label={loadingMoreLabel} />
        </Box>
      )}
    </Paper>
  );
}

interface FilterSelectProps<T extends FilterOption> {
  label: string;
  /** O texto do item que tira o filtro: "Todos" ou "Todas". */
  allLabel: string;
  /** O item filtrado, ou `null` para o padrão ("Todos"/"Todas"). */
  value: T | null;
  /** As opções, sem o item "Todos"/"Todas", que o seletor acrescenta. */
  options: T[];
  onChange: (option: T | null) => void;
  noOptionsText: string;
  /**
   * As opções vêm de uma busca no servidor, que já as filtra pelo texto digitado. Sem isto, o
   * seletor filtra a lista dada, sem diferenciar maiúsculas e acentos.
   */
  serverSearch?: boolean;
  /** O texto digitado, aparado; vazio quando o campo só mostra o valor escolhido. */
  onTyped?: (text: string) => void;
  onOpen?: () => void;
  /** Carregando as primeiras opções. */
  loading?: boolean;
  /** O nome do indicador de mais itens chegando, ou `null` quando nada está chegando. */
  loadingMoreLabel?: string | null;
  loadingText?: string;
  /** Pede mais itens: a rolagem chegou perto do fim, ou a descida pelo teclado. */
  onNearEnd?: () => void;
  failedText?: string | null;
  minWidth?: number;
}

/**
 * O seletor dos filtros da lista de atividades: seleção única, "Todos"/"Todas" como padrão e busca
 * pelo texto digitado, no cliente ou no servidor. Com o campo recém-aberto mostra todas as opções,
 * mesmo com uma já escolhida, e digitar esconde "Todos"/"Todas".
 */
export function FilterSelect<T extends FilterOption>({
  label,
  allLabel,
  value,
  options,
  onChange,
  noOptionsText,
  serverSearch = false,
  onTyped,
  onOpen,
  loading = false,
  loadingMoreLabel = null,
  loadingText,
  onNearEnd,
  failedText = null,
  minWidth = 200,
}: FilterSelectProps<T>) {
  const [typed, setTyped] = useState('');
  // O mesmo objeto a cada renderização: um novo seria um valor novo para o campo, que apagaria o
  // texto que o usuário está digitando.
  const all = useMemo(() => ({ id: ALL_ID, name: allLabel }) as T, [allLabel]);

  // "Todos" só aparece sem texto digitado; o item escolhido, quando está fora da leva carregada,
  // entra na lista para o campo reconhecer o valor.
  const withChosen =
    serverSearch &&
    value &&
    typed === '' &&
    !options.some((option) => option.id === value.id)
      ? [value, ...options]
      : options;
  const shown = typed === '' ? [all, ...withChosen] : withChosen;

  const changeTyped = (text: string) => {
    setTyped(text);
    onTyped?.(text);
  };

  const nearEnd = (event: SyntheticEvent<HTMLElement>) => {
    const list = event.currentTarget;
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - NEAR_END_PX) {
      onNearEnd?.();
    }
  };

  return (
    <LoadingMoreContext value={loadingMoreLabel}>
      <Autocomplete<T, false, true, false>
        options={shown}
        value={value ?? all}
        disableClearable
        filterOptions={serverSearch ? (list) => list : undefined}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, chosen) => option.id === chosen.id}
        loading={loading}
        loadingText={loadingText}
        noOptionsText={noOptionsText}
        onOpen={onOpen}
        onClose={() => changeTyped('')}
        onChange={(_, option) => onChange(option.id === ALL_ID ? null : option)}
        // Só o que o usuário digita vira busca: o nome do valor escolhido não é busca.
        onInputChange={(_, text, reason) =>
          changeTyped(reason === 'input' ? text.trim() : '')
        }
        onHighlightChange={(_, option, reason) => {
          if (reason !== 'keyboard' || !option || !onNearEnd) return;
          const index = shown.findIndex((item) => item.id === option.id);
          if (index >= shown.length - NEAR_END_OPTIONS) onNearEnd();
        }}
        slotProps={{ listbox: { onScroll: nearEnd } }}
        slots={{ paper: ListPaper }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            helperText={failedText ?? undefined}
            error={failedText !== null}
          />
        )}
        sx={{ minWidth: { sm: minWidth } }}
      />
    </LoadingMoreContext>
  );
}
