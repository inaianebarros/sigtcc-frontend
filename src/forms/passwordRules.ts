import type { AccountForm } from '../registration/accountForm';

export const passwordsMatch = (
  form: Pick<AccountForm, 'password' | 'passwordConfirmation'>,
) => form.password === form.passwordConfirmation;

export const passwordsMismatch = {
  path: ['passwordConfirmation'],
  message: 'As senhas não coincidem.',
};
