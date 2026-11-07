import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Link, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ChangeEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { z } from 'zod';
import { PasswordField } from '../components/PasswordField';
import { applyApiFieldErrors } from '../forms/applyApiFieldErrors';
import { passwordsMatch, passwordsMismatch } from '../forms/passwordRules';
import { ApiError } from '../services/apiError';
import { changePassword } from '../services/passwordChangeService';

// O servidor é quem decide a força da senha; aqui só se pede que os campos venham preenchidos.
const changeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    password: z.string().min(1, 'Informe a nova senha.'),
    passwordConfirmation: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine(passwordsMatch, passwordsMismatch);

type ChangeForm = z.infer<typeof changeSchema>;

const EMPTY_FORM: ChangeForm = {
  currentPassword: '',
  password: '',
  passwordConfirmation: '',
};

const FIELD_BY_API_FIELD = {
  current_password: 'currentPassword',
  password: 'password',
  password_confirmation: 'passwordConfirmation',
} as const;

interface ChangePasswordPageProps {
  /** Para onde o "Cancelar" e o "Voltar ao perfil" levam. */
  profilePath: string;
}

export function ChangePasswordPage({ profilePath }: ChangePasswordPageProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeForm>({
    resolver: zodResolver(changeSchema),
    defaultValues: EMPTY_FORM,
  });

  // Voltar a digitar apaga o aviso de sucesso e o alerta da tentativa anterior.
  const field = (name: keyof ChangeForm) => {
    const registered = register(name);
    return {
      ...registered,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        setChanged(false);
        setFormError(null);
        return registered.onChange(event);
      },
      error: Boolean(errors[name]),
      helperText: errors[name]?.message,
    };
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setChanged(false);
    try {
      await changePassword({
        current_password: values.currentPassword,
        password: values.password,
        password_confirmation: values.passwordConfirmation,
      });
      reset(EMPTY_FORM);
      setChanged(true);
    } catch (error) {
      const message = applyApiFieldErrors(error, FIELD_BY_API_FIELD, setError);
      // Com erros por campo a pessoa corrige o que está errado; em qualquer outra falha as
      // senhas não ficam na tela.
      const byField =
        error instanceof ApiError && Object.keys(error.fieldErrors).length > 0;
      if (!byField) reset(EMPTY_FORM);
      setFormError(message);
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
          Alterar senha
        </Typography>
        {changed && (
          <Alert severity="success" role="status">
            Senha alterada com sucesso. Os outros dispositivos foram
            desconectados.{' '}
            <Link component={RouterLink} to={profilePath}>
              Voltar ao perfil
            </Link>
          </Alert>
        )}
        {formError && <Alert severity="error">{formError}</Alert>}
        <PasswordField
          label="Senha atual"
          autoComplete="current-password"
          {...field('currentPassword')}
        />
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          {...field('password')}
        />
        <PasswordField
          label="Confirmação da nova senha"
          autoComplete="new-password"
          {...field('passwordConfirmation')}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
        <Link component={RouterLink} to={profilePath}>
          Cancelar
        </Link>
      </Stack>
    </Paper>
  );
}
