import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Link, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Link as RouterLink,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { z } from 'zod';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { PasswordField } from '../components/PasswordField';
import { useSession } from '../hooks/useSession';
import { homePathFor, paths } from '../navigation/paths';
import { passwordsMatch, passwordsMismatch } from '../forms/passwordRules';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { ApiError } from '../services/apiError';
import { resetPassword } from '../services/passwordRecoveryService';

const resetSchema = z
  .object({
    password: z.string().min(1, 'Informe a nova senha.'),
    passwordConfirmation: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine(passwordsMatch, passwordsMismatch);

type ResetForm = z.infer<typeof resetSchema>;

const formFieldByApiField = {
  password: 'password',
  password_confirmation: 'passwordConfirmation',
} as const;

const INVALID_LINK_MESSAGE =
  'Este link de redefinição é inválido, expirou ou já foi usado. Solicite um novo link.';
const RESET_NOTICE = 'Senha redefinida com sucesso. Entre com a nova senha.';
const INVALID_LINK_STATUS = 400;

export function ResetPasswordPage() {
  const { status, user } = useSession();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [searchParams] = useSearchParams();
  const [link] = useState(() => ({
    uid: searchParams.get('uid') ?? '',
    token: searchParams.get('token') ?? '',
  }));
  const [linkRejected, setLinkRejected] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  });

  // O link carrega credenciais: tira da barra de endereço e do histórico.
  useEffect(() => {
    if (search) navigate(pathname, { replace: true });
  }, [navigate, pathname, search]);

  if (status === 'loading') return <LoadingIndicator />;
  if (status === 'authenticated' && user) {
    return <Navigate to={homePathFor(user.type)} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await resetPassword({
        ...link,
        password: values.password,
        password_confirmation: values.passwordConfirmation,
      });
      navigate(paths.login, { replace: true, state: { notice: RESET_NOTICE } });
    } catch (error) {
      if (error instanceof ApiError && error.status === INVALID_LINK_STATUS) {
        setLinkRejected(true);
        return;
      }
      setFormError(applyApiFieldErrors(error, formFieldByApiField, setError));
    }
  });

  const linkUsable = Boolean(link.uid && link.token) && !linkRejected;

  return (
    <Paper
      component="form"
      onSubmit={onSubmit}
      noValidate
      sx={{ maxWidth: 440, mx: 'auto', p: { xs: 2, sm: 4 } }}
    >
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Redefinir senha
        </Typography>
        {linkUsable ? (
          <>
            {formError && <Alert severity="error">{formError}</Alert>}
            <PasswordField
              label="Nova senha"
              autoComplete="new-password"
              error={Boolean(errors.password)}
              helperText={errors.password?.message}
              {...register('password')}
            />
            <PasswordField
              label="Confirmação da nova senha"
              autoComplete="new-password"
              error={Boolean(errors.passwordConfirmation)}
              helperText={errors.passwordConfirmation?.message}
              {...register('passwordConfirmation')}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Redefinindo…' : 'Redefinir senha'}
            </Button>
          </>
        ) : (
          <>
            <Alert severity="error">{INVALID_LINK_MESSAGE}</Alert>
            <Link component={RouterLink} to={paths.forgotPassword}>
              Solicitar novo link
            </Link>
          </>
        )}
        <Link component={RouterLink} to={paths.login}>
          Voltar ao login
        </Link>
      </Stack>
    </Paper>
  );
}
