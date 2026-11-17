import {
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useId, useState } from 'react';
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
  /** Para onde o botão "Alterar senha" leva. */
  changePasswordPath: string;
  /** Uma alteração pendente fora deste formulário (como o tema do aluno), para o aviso de sair da tela. */
  externalPending?: boolean;
  /** O que a barra de salvar diz quando há alteração pendente fora do formulário. */
  externalPendingNote?: string;
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
  changePasswordPath,
  externalPending = false,
  externalPendingNote,
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
  // Depois de salvar a barra some com o botão: o foco vai para o título, e não para o `body`.
  const titleId = useId();
  const focusTitle = () =>
    document.getElementById(titleId)?.focus({ preventScroll: true });
  const blocker = useUnsavedChangesGuard(
    (isDirty || externalPending) && status === 'authenticated',
  );
  const common = form as unknown as UseFormReturn<ProfileFormValues>;

  const onSubmit = handleSubmit(async (values) => {
    const changes = toChanges(values, dirtyFields as DirtyFields, baseline);
    if (Object.keys(changes).length === 0) {
      reset(toValues(baseline) as unknown as TValues);
      notify('Nenhuma alteração para salvar.', 'info');
      focusTitle();
      return;
    }
    try {
      const saved = await save(changes);
      setBaseline(saved);
      reset(toValues(saved) as unknown as TValues);
      notify('Perfil atualizado com sucesso.', 'success');
      focusTitle();
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

  // As seções ficam direto sobre o papel de fundo, sem caixa em volta: os cartões dos artigos são
  // as únicas caixas, e só a barra de salvar tem fundo próprio.
  return (
    <FormProvider {...form}>
      <Box component="form" onSubmit={onSubmit} noValidate>
        <Stack spacing={4} divider={<Divider />}>
          <Box>
            <Typography
              variant="h1"
              component="h1"
              tabIndex={-1}
              id={titleId}
              sx={{ outline: 'none' }}
            >
              Meu perfil
            </Typography>
            <Typography color="text.secondary">
              Gerencie suas informações pessoais e acadêmicas.
            </Typography>
          </Box>
          <ProfileSection title="Informações pessoais">
            {nameField}
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Dados do seu cadastro, que não são editados aqui:
              </Typography>
              {facts}
            </Stack>
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
              useFlexGap
              sx={{
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              }}
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
        </Stack>
        <SaveBar
          visible={isDirty}
          saving={isSubmitting}
          note={externalPending ? externalPendingNote : undefined}
        />
      </Box>
      <UnsavedChangesDialog blocker={blocker} />
    </FormProvider>
  );
}
