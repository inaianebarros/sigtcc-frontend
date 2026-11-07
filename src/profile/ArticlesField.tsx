import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MAX_ARTICLES } from './profileForm';
import type { ProfileFormValues } from './profileForm';

export function ArticlesField() {
  const {
    control,
    register,
    getValues,
    formState: { errors },
  } = useFormContext<ProfileFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'articles',
  });
  // O título fica guardado: o texto do diálogo não pode mudar durante a animação de saída.
  const [removing, setRemoving] = useState<{
    index: number;
    title: string;
  } | null>(null);
  const [lastRemoving, setLastRemoving] = useState('');
  const listError = errors.articles?.root?.message ?? errors.articles?.message;

  return (
    <Stack spacing={2} component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
      <Typography component="legend" variant="h6">
        Artigos publicados
      </Typography>
      {listError && <Alert severity="error">{listError}</Alert>}
      {fields.map((field, index) => {
        const rowErrors = errors.articles?.[index];
        return (
          <Stack
            key={field.id}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'flex-start' } }}
          >
            <TextField
              label="Título do artigo"
              sx={{ flexGrow: 1 }}
              error={Boolean(rowErrors?.title)}
              helperText={rowErrors?.title?.message}
              {...register(`articles.${index}.title`)}
            />
            <TextField
              label="Ano"
              type="number"
              sx={{ width: { sm: 120 } }}
              error={Boolean(rowErrors?.year)}
              helperText={rowErrors?.year?.message}
              {...register(`articles.${index}.year`)}
            />
            <TextField
              label="Endereço (URL)"
              sx={{ flexGrow: 1 }}
              error={Boolean(rowErrors?.url)}
              helperText={rowErrors?.url?.message}
              {...register(`articles.${index}.url`)}
            />
            <Button
              color="error"
              onClick={() => {
                const title = getValues(`articles.${index}.title`).trim();
                setLastRemoving(title);
                setRemoving({ index, title });
              }}
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            >
              Remover artigo {index + 1}
            </Button>
          </Stack>
        );
      })}
      <Button
        variant="outlined"
        onClick={() => append({ title: '', year: '', url: '' })}
        disabled={fields.length >= MAX_ARTICLES}
        sx={{ alignSelf: 'flex-start' }}
      >
        Adicionar artigo
      </Button>
      {fields.length >= MAX_ARTICLES && (
        <Typography variant="body2" color="text.secondary">
          Você chegou ao limite de {MAX_ARTICLES} artigos.
        </Typography>
      )}
      <ConfirmDialog
        open={removing !== null}
        title="Remover artigo?"
        message={
          lastRemoving
            ? `O artigo "${lastRemoving}" será removido da lista. A remoção só vale depois de salvar o perfil.`
            : 'O artigo será removido da lista. A remoção só vale depois de salvar o perfil.'
        }
        confirmLabel="Remover"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing !== null) remove(removing.index);
          setRemoving(null);
        }}
      />
    </Stack>
  );
}
