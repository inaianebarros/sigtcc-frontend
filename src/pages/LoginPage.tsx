import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
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
    return error.status === 401
      ? INVALID_CREDENTIALS_MESSAGE
      : messageForStatus(error.status);
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
      sx={{ maxWidth: 440, mx: 'auto', p: { xs: 2, sm: 4 } }}
    >
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Entrar
        </Typography>
        {notice && <Alert severity="success">{notice}</Alert>}
        {expiredMessage && <Alert severity="warning">{expiredMessage}</Alert>}
        {submitError && <Alert severity="error">{submitError}</Alert>}
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
        <Stack spacing={1}>
          <Link component={RouterLink} to={paths.forgotPassword}>
            Esqueci minha senha
          </Link>
          <Link component={RouterLink} to={paths.registerStudent}>
            Cadastrar como aluno
          </Link>
          <Link component={RouterLink} to={paths.registerTeacher}>
            Cadastrar como professor
          </Link>
        </Stack>
      </Stack>
    </Paper>
  );
}
