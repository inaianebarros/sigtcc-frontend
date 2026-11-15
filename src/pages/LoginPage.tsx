import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { PasswordField } from '../components/PasswordField';
import { useSession } from '../hooks/useSession';
import { homePathFor, paths } from '../navigation/paths';
import { ApiError, messageForStatus } from '../services/apiError';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe o e-mail.')
    .pipe(z.email('Informe um e-mail válido.')),
  password: z.string().min(1, 'Informe a senha.'),
});

type LoginForm = z.infer<typeof loginSchema>;

const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return INVALID_CREDENTIALS_MESSAGE;
    if (error.status === 429) return error.message;
    return messageForStatus(error.status);
  }
  return messageForStatus(0);
}

function noticeFrom(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const { notice } = state as { notice?: unknown };
  return typeof notice === 'string' ? notice : null;
}

export function LoginPage() {
  const { status, user, expiredMessage, signIn } = useSession();
  const notice = noticeFrom(useLocation().state);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (status === 'loading') {
    return <LoadingIndicator />;
  }
  if (status === 'authenticated' && user) {
    return <Navigate to={homePathFor(user.type)} replace />;
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null);
    try {
      await signIn(email, password);
    } catch (error) {
      setSubmitError(submitErrorMessage(error));
    }
  });

  return (
    <Paper
      component="form"
      onSubmit={onSubmit}
      noValidate
      variant="outlined"
      sx={{
        maxWidth: 440,
        mx: 'auto',
        mt: { xs: 0, sm: 4 },
        p: { xs: 3, sm: 4 },
        borderRadius: 3,
      }}
    >
      <Stack spacing={3}>
        <Typography variant="h2" component="h1">
          Entrar
        </Typography>
        {(notice || expiredMessage || submitError) && (
          <Stack spacing={1.5}>
            {notice && <Alert severity="success">{notice}</Alert>}
            {expiredMessage && (
              <Alert severity="warning">{expiredMessage}</Alert>
            )}
            {submitError && <Alert severity="error">{submitError}</Alert>}
          </Stack>
        )}
        <Stack spacing={2}>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...register('email')}
          />
          <PasswordField
            label="Senha"
            autoComplete="current-password"
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            {...register('password')}
          />
          <Link
            component={RouterLink}
            to={paths.forgotPassword}
            variant="body2"
            sx={{ alignSelf: 'flex-end' }}
          >
            Esqueci minha senha
          </Link>
        </Stack>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
        <Divider />
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Ainda não tem conta?
          </Typography>
          <Button
            component={RouterLink}
            to={paths.registerStudent}
            variant="outlined"
          >
            Cadastrar como aluno
          </Button>
          <Button
            component={RouterLink}
            to={paths.registerTeacher}
            variant="outlined"
          >
            Cadastrar como professor
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
