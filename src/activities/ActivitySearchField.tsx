import { TextField } from '@mui/material';
import { useEffect, useEffectEvent, useState } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const SEARCH_PAUSE_MS = 400;
/** O mesmo limite do servidor para o texto da busca. */
const MAX_SEARCH_LENGTH = 200;

interface ActivitySearchFieldProps {
  /** A busca que está na URL. */
  value: string;
  onSearch: (search: string) => void;
}

/**
 * O campo "Título da atividade": a busca só vai para a URL (e ao servidor) depois de 400 ms sem
 * digitação. Quando a URL muda por fora, como no "Limpar filtros", o campo acompanha.
 */
export function ActivitySearchField({
  value,
  onSearch,
}: ActivitySearchFieldProps) {
  const [text, setText] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    setText(value);
  }

  const debounced = useDebouncedValue(text.trim(), SEARCH_PAUSE_MS);
  const publish = useEffectEvent((search: string) => {
    if (search !== value) onSearch(search);
  });
  useEffect(() => {
    publish(debounced);
  }, [debounced]);

  return (
    <TextField
      label="Título da atividade"
      value={text}
      onChange={(event) => setText(event.target.value)}
      slotProps={{ htmlInput: { maxLength: MAX_SEARCH_LENGTH } }}
      sx={{ minWidth: { sm: 280 } }}
    />
  );
}
