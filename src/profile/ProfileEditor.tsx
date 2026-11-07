import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type {
  DefaultValues,
  Path,
  Resolver,
  UseFormReturn,
} from 'react-hook-form';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { useFeedback } from '../hooks/useFeedback';
import { useSession } from '../hooks/useSession';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { AreasField } from '../registration/CatalogFields';
import type { AreaOfInterest } from '../services/catalogService';
import { ArticlesField } from './ArticlesField';
import { PendingChangesNotice } from './PendingChangesNotice';
import type {
  DirtyFields,
  ProfileBase,
  ProfileFormValues,
} from './profileForm';

interface ProfileEditorProps<
  TProfile extends ProfileBase,
  TValues extends ProfileFormValues,
  TChanges extends object,
> {
  profile: TProfile;
  areas: AreaOfInterest[];
  resolver: Resolver<TValues>;
  toValues: (profile: TProfile) => TValues;
  toChanges: (
    values: TValues,
    dirtyFields: DirtyFields,
    baseline: TProfile,
  ) => TChanges;
  save: (changes: TChanges) => Promise<TProfile>;
  fieldByApiField: Record<string, Path<TValues>>;
  /** Dados somente leitura, mostrados logo abaixo do título. */
  facts: ReactNode;
  /** Campos editáveis próprios do perfil, entre o nome e as áreas. */
  extraFields?: ReactNode;
  /** Campos editáveis próprios do perfil, depois dos artigos. */
  trailingFields?: ReactNode;
}

/**
 * O fluxo comum das telas de edição de perfil (RNF28): um só botão grava tudo, só o que mudou
 * é enviado, os erros do servidor aparecem nos campos e sair com pendências pede confirmação.
 */
export function ProfileEditor<
  TProfile extends ProfileBase,
  TValues extends ProfileFormValues,
  TChanges extends object,
>({
  profile,
  areas,
  resolver,
  toValues,
  toChanges,
  save,
  fieldByApiField,
  facts,
  extraFields,
  trailingFields,
}: ProfileEditorProps<TProfile, TValues, TChanges>) {
  const { notify } = useFeedback();
  const { status, refreshUser } = useSession();
  const [baseline, setBaseline] = useState(profile);
  const form = useForm<TValues>({
    resolver,
    defaultValues: toValues(profile) as DefaultValues<TValues>,
  });
  const {
    handleSubmit,
    reset,
    setError,
    formState: { isDirty, dirtyFields, isSubmitting },
  } = form;
  const blocker = useUnsavedChangesGuard(isDirty && status === 'authenticated');
  const common = form as unknown as UseFormReturn<ProfileFormValues>;

  const onSubmit = handleSubmit(async (values) => {
    const changes = toChanges(values, dirtyFields as DirtyFields, baseline);
    if (Object.keys(changes).length === 0) {
      reset(toValues(baseline) as unknown as TValues);
      notify('Nenhuma alteração para salvar.', 'info');
      return;
    }
    try {
      const saved = await save(changes);
      setBaseline(saved);
      reset(toValues(saved) as unknown as TValues);
      notify('Perfil atualizado com sucesso.', 'success');
      void refreshUser();
    } catch (error) {
      const message = applyApiFieldErrors(error, fieldByApiField, setError);
      if (message) notify(message, 'error');
    }
  });

  return (
    <FormProvider {...form}>
      <Paper
        component="form"
        onSubmit={onSubmit}
        noValidate
        sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, sm: 4 } }}
      >
        <Stack spacing={3}>
          <PendingChangesNotice visible={isDirty} />
          <Typography variant="h4" component="h1">
            Meu perfil
          </Typography>
          {facts}
          <TextField
            label="Nome completo"
            autoComplete="name"
            error={Boolean(common.formState.errors.fullName)}
            helperText={common.formState.errors.fullName?.message}
            {...common.register('fullName')}
          />
          {extraFields}
          <AreasField areas={{ status: 'ready', data: areas }} />
          <ArticlesField />
          {trailingFields}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={!isDirty || isSubmitting}
          >
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </Stack>
      </Paper>
      <UnsavedChangesDialog blocker={blocker} />
    </FormProvider>
  );
}
