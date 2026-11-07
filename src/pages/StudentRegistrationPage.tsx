import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Link,
  MenuItem,
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
  toAccountPayload,
} from '../registration/accountForm';
import { passwordsMatch, passwordsMismatch } from '../forms/passwordRules';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import {
  CATALOG_ERROR_MESSAGE,
  courseListHint,
  useCatalog,
} from '../registration/useCatalog';
import { listCourses } from '../services/catalogService';
import { registerStudent } from '../services/registrationService';

const studentSchema = z
  .object({
    ...accountShape,
    courseId: z.string().min(1, 'Escolha o curso.'),
  })
  .refine(passwordsMatch, passwordsMismatch);

type StudentForm = z.infer<typeof studentSchema>;

const formFieldByApiField = {
  ...accountFieldByApiField,
  course_id: 'courseId',
} as const;

export function StudentRegistrationPage() {
  const { status, user } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const catalog = useCatalog();
  const form = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: { ...accountDefaults, courseId: '' },
  });
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
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
      await registerStudent({
        ...toAccountPayload(values),
        course_id: Number(values.courseId),
      });
      navigate(paths.login, {
        replace: true,
        state: { notice: REGISTERED_NOTICE },
      });
    } catch (error) {
      setFormError(applyApiFieldErrors(error, formFieldByApiField, setError));
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
            Cadastro de aluno
          </Typography>
          {catalog.failed && (
            <Alert severity="error">{CATALOG_ERROR_MESSAGE}</Alert>
          )}
          {formError && <Alert severity="error">{formError}</Alert>}
          <AccountFields />
          <InstituteField
            institutes={catalog.institutes}
            onChange={() => {
              setValue('courseId', '');
              clearErrors('courseId');
            }}
          />
          <Controller
            name="courseId"
            control={control}
            render={({ field }) => (
              <TextField
                select
                label="Curso"
                {...field}
                disabled={courses.status !== 'ready'}
                error={Boolean(errors.courseId)}
                helperText={errors.courseId?.message ?? courseListHint(courses)}
              >
                {courseOptions.map((course) => (
                  <MenuItem key={course.id} value={String(course.id)}>
                    {course.name}
                  </MenuItem>
                ))}
              </TextField>
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
