import {
  Autocomplete,
  Box,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useAdviseeSearch } from './useAdviseeSearch';
import type { AdviseeChoice } from './useAdviseeSearch';

export const NO_TOPIC_LABEL = 'Sem tema';

interface AdviseeSearchFieldProps {
  label: string;
  value: { id: number; name: string } | null;
  onChange: (choice: { id: number; name: string } | null) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * O campo do aluno do professor (RF18): busca pelo nome e lista `{nome} - {tema}`. O tema é
 * cortado com reticências por CSS, adaptado à largura, e o texto inteiro fica no tooltip; o
 * nome nunca é cortado antes do tema.
 */
export function AdviseeSearchField({
  label,
  value,
  onChange,
  error,
  disabled = false,
}: AdviseeSearchFieldProps) {
  const [typed, setTyped] = useState('');
  // Com o aluno já escolhido, reabrir a lista mostra todos, e não só ele.
  const search = useAdviseeSearch(typed === value?.name ? '' : typed);
  return (
    <Autocomplete<AdviseeChoice, false, false, false>
      options={search.options}
      loading={search.loading}
      loadingText="Buscando orientandos…"
      noOptionsText="Nenhum orientando encontrado"
      clearText="Limpar"
      // Pelo teclado, Esc limpa o aluno escolhido (o botão só aparece com o mouse ou o foco).
      clearOnEscape
      disabled={disabled}
      // A busca é feita no servidor: a lista já vem filtrada.
      filterOptions={(options) => options}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, chosen) => option.id === chosen.id}
      value={value ? { ...value, thesisTopic: null } : null}
      onChange={(_, choice) =>
        onChange(choice ? { id: choice.id, name: choice.name } : null)
      }
      onInputChange={(_, text) => setTyped(text)}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        const topic = option.thesisTopic ?? NO_TOPIC_LABEL;
        return (
          <Box
            component="li"
            key={key}
            {...rest}
            // O nome e o tema inteiros para o leitor de tela, mesmo com o tema cortado na tela.
            aria-label={`${option.name} - ${topic}`}
            sx={{ display: 'flex', gap: 0.5, minWidth: 0 }}
          >
            <Typography
              component="span"
              sx={{ flexShrink: 0, fontWeight: 600 }}
            >
              {option.name}
            </Typography>
            <Typography component="span" sx={{ flexShrink: 0 }}>
              {' - '}
            </Typography>
            <Tooltip title={topic} placement="top-start">
              <Typography
                component="span"
                sx={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {topic}
              </Typography>
            </Tooltip>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={Boolean(error)}
          helperText={
            error ??
            (search.failed
              ? 'Não foi possível buscar os orientandos.'
              : search.total > search.options.length
                ? `Mostrando ${search.options.length} de ${search.total}. Refine a busca.`
                : undefined)
          }
        />
      )}
    />
  );
}
