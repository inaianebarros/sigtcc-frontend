import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import type { ChangeEvent, DragEvent } from 'react';
import { formatFileSize } from '../formatters/fileSize';
import type { ChosenFiles } from './useChosenFiles';
import { ACCEPTED_EXTENSIONS, contentTypeOf } from './fileValidation';

interface ChosenFilesFieldProps {
  chosenFiles: ChosenFiles;
  /** O que o campo aceita, dito ao lado do botão: quantidade, tamanho e tipos. */
  instructions: string;
  /** O aviso de mais arquivos do que cabem. */
  overflowMessage: string;
}

/** A área de soltar, o botão nativo de escolha e a lista de arquivos com remoção (RF31, RF46). */
export function ChosenFilesField({
  chosenFiles,
  instructions,
  overflowMessage,
}: ChosenFilesFieldProps) {
  const { chosen, problems, overflowed, serverErrors, disabled, add, remove } =
    chosenFiles;

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    add(Array.from(event.target.files ?? []));
    // Para escolher o mesmo arquivo de novo depois de removê-lo.
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    add(Array.from(event.dataTransfer.files));
  };

  return (
    <>
      <Box
        role="group"
        aria-label="Área para soltar arquivos"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        sx={{
          border: 2,
          borderStyle: 'dashed',
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
          textAlign: 'center',
        }}
      >
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
          <Typography color="text.secondary">{instructions}</Typography>
          <Button component="label" variant="outlined" disabled={disabled}>
            Escolher arquivos
            <input
              hidden
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS}
              disabled={disabled}
              onChange={onPick}
            />
          </Button>
        </Stack>
      </Box>
      {overflowed && <Alert severity="warning">{overflowMessage}</Alert>}
      {chosen.length === 0 ? (
        <Typography color="text.secondary">
          Nenhum arquivo escolhido.
        </Typography>
      ) : (
        <Box
          component="ul"
          aria-label="Arquivos escolhidos"
          sx={{ m: 0, p: 0, listStyle: 'none' }}
        >
          {chosen.map(({ key, file }, index) => {
            const message = problems[index] ?? serverErrors[key];
            return (
              <Stack
                component="li"
                key={key}
                direction="row"
                sx={{ alignItems: 'flex-start', gap: 1, py: 0.5 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    {file.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {`${formatFileSize(file.size)}, ${contentTypeOf(file.name) ?? 'tipo não reconhecido'}`}
                  </Typography>
                  {message && (
                    <Typography variant="body2" color="error">
                      {message}
                    </Typography>
                  )}
                </Box>
                <IconButton
                  aria-label={`Remover ${file.name}`}
                  disabled={disabled}
                  onClick={() => remove(key)}
                >
                  <DeleteOutlinedIcon />
                </IconButton>
              </Stack>
            );
          })}
        </Box>
      )}
    </>
  );
}
