import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
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
import { ArticleCards } from './ArticleCards';
import { ArticlesField } from './ArticlesField';
import { PendingChangesNotice } from './PendingChangesNotice';
import { ProfileSection } from './ProfileSection';
import { SaveBar } from './SaveBar';
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
  /** Seções salvas na hora, fora do formulário, mostradas depois dele (como as propostas de tema). */
  afterForm?: ReactNode;
  /** Para onde o botão "Alterar senha" leva. */
  changePasswordPath: string;
  /**
   * `sections` é o perfil do aluno: seções com título, artigos em cartões e a barra de salvar fixa.
   * O padrão, `classic`, é o formulário corrido do professor.
   */
  layout?: 'classic' | 'sections';
  /** Uma alteração pendente fora deste formulário (como o tema do aluno), para o aviso de sair da tela. */
  externalPending?: boolean;
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
  afterForm,
  changePasswordPath,
  layout = 'classic',
  externalPending = false,
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
  const blocker = useUnsavedChangesGuard(
    (isDirty || externalPending) && status === 'authenticated',
  );
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

  const nameField = (
    <TextField
      label="Nome completo"
      autoComplete="name"
      error={Boolean(common.formState.errors.fullName)}
      helperText={common.formState.errors.fullName?.message}
      {...common.register('fullName')}
    />
  );

  if (layout === 'sections') {
    return (
      <FormProvider {...form}>
        <Paper
          component="form"
          onSubmit={onSubmit}
          noValidate
          variant="outlined"
          sx={{
            maxWidth: 720,
            mx: 'auto',
            p: { xs: 2, sm: 4 },
            borderRadius: 3,
          }}
        >
          <Stack spacing={5}>
            <Box>
              <Typography variant="h2" component="h1">
                Meu perfil
              </Typography>
              <Typography color="text.secondary">
                Gerencie suas informações pessoais e acadêmicas.
              </Typography>
            </Box>
            <ProfileSection title="Informações pessoais">
              {facts}
              {nameField}
            </ProfileSection>
            {extraFields}
            <ProfileSection
              title="Áreas de interesse"
              description="Áreas relacionadas aos seus interesses acadêmicos."
            >
              <AreasField areas={{ status: 'ready', data: areas }} />
            </ProfileSection>
            <ArticleCards />
            {trailingFields}
            <ProfileSection title="Segurança">
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography variant="subtitle1" component="h3">
                    Senha
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Altere sua senha de acesso ao sistema.
                  </Typography>
                </Box>
                <Button
                  component={RouterLink}
                  to={changePasswordPath}
                  variant="outlined"
                >
                  Alterar senha
                </Button>
              </Stack>
            </ProfileSection>
            <SaveBar visible={isDirty} saving={isSubmitting} />
          </Stack>
        </Paper>
        {afterForm}
        <UnsavedChangesDialog blocker={blocker} />
      </FormProvider>
    );
  }

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
          {nameField}
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
          <Button
            component={RouterLink}
            to={changePasswordPath}
            variant="outlined"
          >
            Alterar senha
          </Button>
        </Stack>
      </Paper>
      {afterForm}
      <UnsavedChangesDialog blocker={blocker} />
    </FormProvider>
  );
}
