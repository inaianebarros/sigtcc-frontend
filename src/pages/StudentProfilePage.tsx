import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import type { LoadState } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { ArticlesField } from '../profile/ArticlesField';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { profileSchema, toChanges, toFormValues } from '../profile/profileForm';
import type { ProfileFormValues } from '../profile/profileForm';
import { ReadOnlyFacts } from '../profile/ReadOnlyFacts';
import { AreasField } from '../registration/CatalogFields';
import {
  listAreasOfInterest,
  listCourses,
  listInstitutes,
} from '../services/catalogService';
import type { AreaOfInterest } from '../services/catalogService';
import {
  getStudentProfile,
  updateStudentProfile,
} from '../services/profileService';
import type { StudentProfile } from '../services/profileService';

function catalogName(
  state: LoadState<{ id: number; name: string }[]>,
  id: number,
): string {
  if (state.status === 'error') return 'Não foi possível carregar.';
  if (state.status !== 'ready') return 'Carregando…';
  return state.data.find((item) => item.id === id)?.name ?? '—';
}

const FIELD_BY_API_FIELD = {
  full_name: 'fullName',
  area_ids: 'areaIds',
  articles: 'articles',
} as const;

function StudentProfileForm({
  profile,
  areas,
}: {
  profile: StudentProfile;
  areas: AreaOfInterest[];
}) {
  const institutes = useLoad(listInstitutes, 'institutes');
  const courses = useLoad(
    () => listCourses(profile.instituteId),
    profile.instituteId,
  );
  const { notify } = useFeedback();
  const { status, refreshUser } = useSession();
  const resolver = useMemo(() => zodResolver(profileSchema()), []);
  const [baseline, setBaseline] = useState(profile);
  const form = useForm<ProfileFormValues>({
    resolver,
    defaultValues: toFormValues(profile),
  });
  const {
    handleSubmit,
    reset,
    setError,
    formState: { isDirty, dirtyFields, isSubmitting },
  } = form;
  const blocker = useUnsavedChangesGuard(isDirty && status === 'authenticated');
  const instituteName = catalogName(institutes, profile.instituteId);
  const courseName = catalogName(courses, profile.courseId);

  const onSubmit = handleSubmit(async (values) => {
    const changes = toChanges(values, dirtyFields, baseline);
    if (Object.keys(changes).length === 0) {
      reset(toFormValues(baseline));
      notify('Nenhuma alteração para salvar.', 'info');
      return;
    }
    try {
      const saved = await updateStudentProfile(changes);
      setBaseline(saved);
      reset(toFormValues(saved));
      notify('Perfil atualizado com sucesso.', 'success');
      void refreshUser();
    } catch (error) {
      const message = applyApiFieldErrors(error, FIELD_BY_API_FIELD, setError);
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
          <ReadOnlyFacts
            facts={[
              ['E-mail', profile.email],
              ['Matrícula', profile.registrationNumber],
              ['Instituto', instituteName],
              ['Curso', courseName],
            ]}
          />
          <TextField
            label="Nome completo"
            autoComplete="name"
            error={Boolean(form.formState.errors.fullName)}
            helperText={form.formState.errors.fullName?.message}
            {...form.register('fullName')}
          />
          <AreasField areas={{ status: 'ready', data: areas }} />
          <ArticlesField />
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

export function StudentProfilePage() {
  const [attempt, setAttempt] = useState(0);
  const profile = useLoad(getStudentProfile, `profile-${attempt}`);
  const areas = useLoad(listAreasOfInterest, `areas-${attempt}`);

  const failed =
    profile.status === 'error'
      ? profile.message
      : areas.status === 'error'
        ? areas.message
        : null;
  if (failed) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 720, mx: 'auto' }}>
        <Alert severity="error">{failed}</Alert>
        <Button onClick={() => setAttempt((current) => current + 1)}>
          Tentar novamente
        </Button>
      </Stack>
    );
  }
  if (profile.status !== 'ready' || areas.status !== 'ready') {
    return <LoadingIndicator />;
  }
  return <StudentProfileForm profile={profile.data} areas={areas.data} />;
}
