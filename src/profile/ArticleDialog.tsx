import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { articleKey, articleSchema } from './profileForm';
import type { ArticleRow } from './profileForm';

const DUPLICATE_MESSAGE =
  'Você já cadastrou um artigo com este título e este ano.';

interface ArticleDialogProps {
  open: boolean;
  /** O artigo que está sendo editado; `null` ao adicionar. */
  article: ArticleRow | null;
  /** Os outros artigos da lista, para recusar o repetido (RN31). */
  others: ArticleRow[];
  onSave: (article: ArticleRow) => void;
  onClose: () => void;
  onExited: () => void;
}

/**
 * Adiciona ou edita um artigo. Só entrega o artigo à lista do perfil: ele é gravado quando a pessoa
 * salva o perfil. Fechar com texto digitado pede confirmação (RNF28).
 */
export function ArticleDialog({
  open,
  article,
  others,
  onSave,
  onClose,
  onExited,
}: ArticleDialogProps) {
  const id = useId();
  const resolver = useMemo(
    () => zodResolver(articleSchema(new Date().getFullYear())),
    [],
  );
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<ArticleRow>({
    resolver,
    defaultValues: article ?? { title: '', year: '', url: '' },
  });
  const { requestClose, dialogs } = useDiscardGuard({
    pending: isDirty,
    open,
    busy: false,
    onClose,
  });

  const submit = handleSubmit((values) => {
    const key = articleKey(values);
    if (others.some((other) => articleKey(other) === key)) {
      setError('title', { message: DUPLICATE_MESSAGE });
      return;
    }
    onSave({
      title: values.title.trim(),
      year: values.year.trim(),
      url: values.url.trim(),
    });
  });

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-hint`}
        fullWidth
        maxWidth="sm"
        slotProps={{ transition: { onExited } }}
      >
        <Box
          component="form"
          noValidate
          onSubmit={(event) => {
            // O diálogo está dentro do formulário do perfil na árvore do React: o envio não pode subir.
            event.stopPropagation();
            void submit(event);
          }}
        >
          <DialogTitle id={`${id}-title`}>
            {article ? 'Editar artigo' : 'Adicionar artigo'}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id={`${id}-hint`} sx={{ mb: 2 }}>
              O artigo só é gravado quando você salva o perfil.
            </DialogContentText>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Título do artigo"
                autoFocus
                error={Boolean(errors.title)}
                helperText={errors.title?.message}
                {...register('title')}
              />
              <TextField
                label="Ano"
                inputMode="numeric"
                error={Boolean(errors.year)}
                helperText={errors.year?.message}
                {...register('year')}
              />
              <TextField
                label="Endereço (URL)"
                inputMode="url"
                error={Boolean(errors.url)}
                helperText={errors.url?.message ?? 'Opcional.'}
                {...register('url')}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={requestClose}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {article ? 'Aplicar alteração' : 'Adicionar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      {dialogs}
    </>
  );
}
