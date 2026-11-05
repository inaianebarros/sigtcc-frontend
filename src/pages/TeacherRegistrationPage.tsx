import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
  Button,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { homePathFor, paths } from '../navigation/paths';
import { AccountFields } from '../registration/AccountFields';
import { AreasField, InstituteField } from '../registration/CatalogFields';
import {
  REGISTERED_NOTICE,
  accountDefaults,
  accountFieldByApiField,
  accountShape,
  passwordsMatch,
  passwordsMismatch,
} from '../registration/accountForm';
import { reportRegistrationError } from '../registration/reportRegistrationError';
import {
  CATALOG_ERROR_MESSAGE,
  courseListHint,
  useCatalog,
} from '../registration/useCatalog';
import { listCourses } from '../services/catalogService';
import { registerTeacher } from '../services/registrationService';

const teacherSchema = z
  .object({
    ...accountShape,
    courseIds: z.array(z.number()).min(1, 'Escolha ao menos um curso.'),
  })
  .refine(passwordsMatch, passwordsMismatch);

type TeacherForm = z.infer<typeof teacherSchema>;

const formFieldByApiField = {
  ...accountFieldByApiField,
  course_ids: 'courseIds',
} as const;

export function TeacherRegistrationPage() {
  const { status, user } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const catalog = useCatalog();
  const form = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { ...accountDefaults, courseIds: [] },
  });
  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const instituteId = useWatch({ control, name: 'instituteId' });
  const courses = useLoad(
    () => listCourses(Number(instituteId)),
    instituteId || null,
  );

  if (status === 'loading') return <LoadingIndicator />;
  if (status === 'authenticated' && user) {
    return <Navigate to={homePathFor(user.type)} replace />;
  }

  const courseOptions = courses.status === 'ready' ? courses.data : [];

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerTeacher({
        registration_number: values.registrationNumber,
        full_name: values.fullName,
        email: values.email,
        password: values.password,
        password_confirmation: values.passwordConfirmation,
        institute_id: Number(values.instituteId),
        course_ids: values.courseIds,
        area_ids: values.areaIds,
      });
      navigate(paths.login, {
        replace: true,
        state: { notice: REGISTERED_NOTICE },
      });
    } catch (error) {
      setFormError(
        reportRegistrationError(error, formFieldByApiField, setError),
      );
    }
  });

  return (
    <FormProvider {...form}>
      <Paper
        component="form"
        onSubmit={onSubmit}
        noValidate
        sx={{ maxWidth: 640, mx: 'auto', p: { xs: 2, sm: 4 } }}
      >
        <Stack spacing={2}>
          <Typography variant="h4" component="h1">
            Cadastro de professor
          </Typography>
          {catalog.failed && (
            <Alert severity="error">{CATALOG_ERROR_MESSAGE}</Alert>
          )}
          {formError && <Alert severity="error">{formError}</Alert>}
          <AccountFields accountType="Professor" />
          <InstituteField
            institutes={catalog.institutes}
            onChange={() => setValue('courseIds', [])}
          />
          <Controller
            name="courseIds"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={courseOptions}
                getOptionLabel={(course) => course.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={courseOptions.filter((course) =>
                  field.value.includes(course.id),
                )}
                onChange={(_, selected) =>
                  field.onChange(selected.map((course) => course.id))
                }
                onBlur={field.onBlur}
                disabled={courses.status !== 'ready'}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cursos"
                    inputRef={field.ref}
                    error={Boolean(errors.courseIds)}
                    helperText={
                      errors.courseIds?.message ?? courseListHint(courses)
                    }
                  />
                )}
              />
            )}
          />
          <AreasField areas={catalog.areas} />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Cadastrando…' : 'Cadastrar'}
          </Button>
          <Link component={RouterLink} to={paths.login}>
            Já tenho conta
          </Link>
        </Stack>
      </Paper>
    </FormProvider>
  );
}
