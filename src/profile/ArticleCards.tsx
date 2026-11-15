import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Box,
  Button,
  Card,
  IconButton,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ArticleDialog } from './ArticleDialog';
import { MAX_ARTICLES } from './profileForm';
import type { ArticleRow, ProfileFormValues } from './profileForm';
import { ProfileSection } from './ProfileSection';

const TOUCH_TARGET = { minWidth: 44, minHeight: 44 } as const;

function countLabel(count: number): string {
  return count === 1 ? '1 artigo' : `${count} artigos`;
}

/**
 * Os artigos do perfil do aluno como cartões, com editar e excluir (RF04). Adicionar e editar
 * abrem um diálogo; a lista só vale quando o perfil é salvo, então tudo passa pelo formulário do
 * perfil e pelo aviso de alterações pendentes (RNF28).
 */
export function ArticleCards() {
  const {
    control,
    formState: { errors },
  } = useFormContext<ProfileFormValues>();
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: 'articles',
  });
  // O índice é `null` ao adicionar. O artigo e o título ficam guardados para não mudarem durante
  // a animação de saída dos diálogos.
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const [lastEditing, setLastEditing] = useState<ArticleRow | null>(null);
  // Uma chave por abertura: o formulário do diálogo começa limpo ou com o artigo escolhido.
  const [openings, setOpenings] = useState(0);
  const [removing, setRemoving] = useState<number | null>(null);
  const [lastRemoving, setLastRemoving] = useState('');
  const listError = errors.articles?.root?.message ?? errors.articles?.message;
  const atLimit = fields.length >= MAX_ARTICLES;

  const open = (index: number | null) => {
    setLastEditing(index === null ? null : (fields[index] ?? null));
    setOpenings((count) => count + 1);
    setEditing({ index });
  };

  return (
    <ProfileSection
      title="Artigos publicados"
      aside={
        <Typography variant="body2" color="text.secondary">
          {countLabel(fields.length)}
        </Typography>
      }
    >
      {listError && <Alert severity="error">{listError}</Alert>}
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => open(null)}
        disabled={atLimit}
        fullWidth
      >
        Adicionar artigo
      </Button>
      {atLimit && (
        <Typography variant="body2" color="text.secondary">
          Você chegou ao limite de {MAX_ARTICLES} artigos.
        </Typography>
      )}
      {fields.length === 0 ? (
        <Typography color="text.secondary">
          Você ainda não cadastrou artigos publicados.
        </Typography>
      ) : (
        <Stack
          component="ul"
          spacing={1.5}
          sx={{ m: 0, p: 0, listStyle: 'none' }}
        >
          {fields.map((field, index) => {
            const rowErrors = errors.articles?.[index];
            const rowMessage =
              rowErrors?.title?.message ??
              rowErrors?.year?.message ??
              rowErrors?.url?.message;
            return (
              <Card component="li" key={field.id} sx={{ p: 2 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle1"
                      component="h3"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {field.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {field.year}
                    </Typography>
                    {field.url && (
                      <Link
                        href={field.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="body2"
                        aria-label={`Acessar publicação de "${field.title}" (abre em nova aba)`}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        Acessar publicação
                        <OpenInNewIcon fontSize="inherit" aria-hidden />
                      </Link>
                    )}
                    {rowMessage && (
                      <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                        {rowMessage}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    aria-label={`Editar o artigo "${field.title}"`}
                    onClick={() => open(index)}
                    sx={TOUCH_TARGET}
                  >
                    <EditOutlinedIcon />
                  </IconButton>
                  <IconButton
                    aria-label={`Excluir o artigo "${field.title}"`}
                    onClick={() => {
                      setLastRemoving(field.title);
                      setRemoving(index);
                    }}
                    sx={TOUCH_TARGET}
                  >
                    <DeleteOutlinedIcon />
                  </IconButton>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
      <ArticleDialog
        key={openings}
        open={editing !== null}
        article={lastEditing}
        others={fields.filter((_, index) => index !== editing?.index)}
        onSave={(article) => {
          if (editing?.index === null || editing === null) append(article);
          else update(editing.index, article);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
        onExited={() => setLastEditing(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        title="Excluir artigo?"
        message={`O artigo "${lastRemoving}" será removido da lista. A exclusão só vale depois de salvar o perfil.`}
        confirmLabel="Excluir"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing !== null) remove(removing);
          setRemoving(null);
        }}
      />
    </ProfileSection>
  );
}
