import { Stack, TextField } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import type { AccountForm } from './accountForm';

export function AccountFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<AccountForm>();

  return (
    <>
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
    </>
  );
}
