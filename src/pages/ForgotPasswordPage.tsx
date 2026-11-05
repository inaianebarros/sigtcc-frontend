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
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { z } from 'zod';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useSession } from '../hooks/useSession';
import { homePathFor, paths } from '../navigation/paths';
import { accountShape } from '../registration/accountForm';
import { ApiError, messageForStatus } from '../services/apiError';
import { requestPasswordReset } from '../services/passwordRecoveryService';

const forgotSchema = z.object({ email: accountShape.email });

type ForgotForm = z.infer<typeof forgotSchema>;

const NEUTRAL_MESSAGE =
  'Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha. O link vale por 1 hora.';

export function ForgotPasswordPage() {
  const { status, user } = useSession();
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  if (status === 'loading') return <LoadingIndicator />;
  if (status === 'authenticated' && user) {
    return <Navigate to={homePathFor(user.type)} replace />;
  }

  const onSubmit = handleSubmit(async ({ email }) => {
    setSubmitError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : messageForStatus(0),
      );
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
          Recuperar senha
        </Typography>
        {sent ? (
          <Alert severity="success">{NEUTRAL_MESSAGE}</Alert>
        ) : (
          <>
            <Typography>
              Informe o e-mail da sua conta para receber um link de redefinição
              de senha.
            </Typography>
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              error={Boolean(errors.email)}
              helperText={errors.email?.message}
              {...register('email')}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando…' : 'Enviar link'}
            </Button>
          </>
        )}
        <Link component={RouterLink} to={paths.login}>
          Voltar ao login
        </Link>
      </Stack>
    </Paper>
  );
}
