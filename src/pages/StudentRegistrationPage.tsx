import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
  Button,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { homePathFor, paths } from '../navigation/paths';
import { ApiError, messageForStatus } from '../services/apiError';
import {
  listAreasOfInterest,
  listCourses,
  listInstitutes,
} from '../services/catalogService';
import { registerStudent } from '../services/registrationService';

const registrationSchema = z
  .object({
    registrationNumber: z
      .string()
      .trim()
      .min(1, 'Informe a matrícula.')
      .max(30, 'A matrícula deve ter no máximo 30 caracteres.'),
    fullName: z
      .string()
      .trim()
      .min(1, 'Informe o nome completo.')
      .max(150, 'O nome deve ter no máximo 150 caracteres.'),
    email: z
      .string()
      .trim()
      .min(1, 'Informe o e-mail.')
      .pipe(z.email('Informe um e-mail válido.')),
    password: z.string().min(1, 'Informe a senha.'),
    passwordConfirmation: z.string().min(1, 'Confirme a senha.'),
    instituteId: z.string().min(1, 'Escolha o instituto.'),
    courseId: z.string().min(1, 'Escolha o curso.'),
    areaIds: z
      .array(z.number())
      .min(1, 'Escolha ao menos uma área de interesse.'),
  })
  .refine((form) => form.password === form.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'As senhas não coincidem.',
  });

type RegistrationForm = z.infer<typeof registrationSchema>;

const formFieldByApiField: Record<string, keyof RegistrationForm> = {
  registration_number: 'registrationNumber',
  full_name: 'fullName',
  email: 'email',
  password: 'password',
  password_confirmation: 'passwordConfirmation',
  institute_id: 'instituteId',
  course_id: 'courseId',
  area_ids: 'areaIds',
};

const REGISTERED_NOTICE =
  'Cadastro realizado com sucesso. Entre com seu e-mail e senha.';
const CATALOG_ERROR_MESSAGE =
  'Não foi possível carregar os institutos e as áreas de interesse. Recarregue a página para tentar novamente.';

export function StudentRegistrationPage() {
  const { status, user } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const institutes = useLoad(listInstitutes, 'institutes');
  const areas = useLoad(listAreasOfInterest, 'areas');
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      registrationNumber: '',
      fullName: '',
      email: '',
      password: '',
      passwordConfirmation: '',
      instituteId: '',
      courseId: '',
      areaIds: [],
    },
  });
  const instituteId = useWatch({ control, name: 'instituteId' });
  const courses = useLoad(
    () => listCourses(Number(instituteId)),
    instituteId || null,
  );

  if (status === 'loading') return <LoadingIndicator />;
  if (status === 'authenticated' && user) {
    return <Navigate to={homePathFor(user.type)} replace />;
  }

  const catalogFailed =
    institutes.status === 'error' || areas.status === 'error';
  const instituteOptions = institutes.status === 'ready' ? institutes.data : [];
  const courseOptions = courses.status === 'ready' ? courses.data : [];
  const areaOptions = areas.status === 'ready' ? areas.data : [];

  const onSubmit = handleSubmit(async (form) => {
    setFormError(null);
    try {
      await registerStudent({
        registration_number: form.registrationNumber,
        full_name: form.fullName,
        email: form.email,
        password: form.password,
        password_confirmation: form.passwordConfirmation,
        institute_id: Number(form.instituteId),
        course_id: Number(form.courseId),
        area_ids: form.areaIds,
      });
      navigate(paths.login, {
        replace: true,
        state: { notice: REGISTERED_NOTICE },
      });
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError(messageForStatus(0));
        return;
      }
      const unmapped: string[] = [];
      for (const [apiField, message] of Object.entries(error.fieldErrors)) {
        const field = formFieldByApiField[apiField];
        if (field) setError(field, { message });
        else unmapped.push(message);
      }
      if (Object.keys(error.fieldErrors).length === 0 || unmapped.length > 0) {
        setFormError(unmapped[0] ?? error.message);
      }
    }
  });

  return (
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
        {catalogFailed && (
          <Alert severity="error">{CATALOG_ERROR_MESSAGE}</Alert>
        )}
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          label="Matrícula"
          error={Boolean(errors.registrationNumber)}
          helperText={errors.registrationNumber?.message}
          {...register('registrationNumber')}
        />
        <TextField
          label="Nome completo"
          autoComplete="name"
          error={Boolean(errors.fullName)}
          helperText={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Senha"
            type="password"
            autoComplete="new-password"
            fullWidth
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            {...register('password')}
          />
          <TextField
            label="Confirmação de senha"
            type="password"
            autoComplete="new-password"
            fullWidth
            error={Boolean(errors.passwordConfirmation)}
            helperText={errors.passwordConfirmation?.message}
            {...register('passwordConfirmation')}
          />
        </Stack>
        <TextField
          label="Tipo de conta"
          value="Aluno"
          slotProps={{ input: { readOnly: true } }}
        />
        <Controller
          name="instituteId"
          control={control}
          render={({ field }) => (
            <TextField
              select
              label="Instituto"
              value={field.value}
              onChange={(event) => {
                field.onChange(event);
                setValue('courseId', '');
              }}
              onBlur={field.onBlur}
              inputRef={field.ref}
              disabled={institutes.status !== 'ready'}
              error={Boolean(errors.instituteId)}
              helperText={errors.instituteId?.message}
            >
              {instituteOptions.map((institute) => (
                <MenuItem key={institute.id} value={String(institute.id)}>
                  {institute.name}
                </MenuItem>
              ))}
            </TextField>
          )}
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
              helperText={errors.courseId?.message}
            >
              {courseOptions.map((course) => (
                <MenuItem key={course.id} value={String(course.id)}>
                  {course.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          name="areaIds"
          control={control}
          render={({ field }) => (
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={areaOptions}
              getOptionLabel={(area) => area.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              value={areaOptions.filter((area) =>
                field.value.includes(area.id),
              )}
              onChange={(_, selected) =>
                field.onChange(selected.map((area) => area.id))
              }
              onBlur={field.onBlur}
              disabled={areas.status !== 'ready'}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Áreas de interesse"
                  inputRef={field.ref}
                  error={Boolean(errors.areaIds)}
                  helperText={errors.areaIds?.message}
                />
              )}
            />
          )}
        />
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
  );
}
