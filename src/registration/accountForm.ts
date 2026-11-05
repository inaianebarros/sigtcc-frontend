import { z } from 'zod';
import type { AccountRegistration } from '../services/registrationService';

export const accountShape = {
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
  areaIds: z
    .array(z.number())
    .min(1, 'Escolha ao menos uma área de interesse.'),
};

export type AccountForm = z.infer<z.ZodObject<typeof accountShape>>;

export const accountDefaults: AccountForm = {
  registrationNumber: '',
  fullName: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  instituteId: '',
  areaIds: [],
};

export const passwordsMatch = (
  form: AccountForm | Pick<AccountForm, 'password' | 'passwordConfirmation'>,
) => form.password === form.passwordConfirmation;

export const passwordsMismatch = {
  path: ['passwordConfirmation'],
  message: 'As senhas não coincidem.',
};

export const accountFieldByApiField = {
  registration_number: 'registrationNumber',
  full_name: 'fullName',
  email: 'email',
  password: 'password',
  password_confirmation: 'passwordConfirmation',
  institute_id: 'instituteId',
  area_ids: 'areaIds',
} as const;

export const REGISTERED_NOTICE =
  'Cadastro realizado com sucesso. Entre com seu e-mail e senha.';

export function toAccountPayload(form: AccountForm): AccountRegistration {
  return {
    registration_number: form.registrationNumber,
    full_name: form.fullName,
    email: form.email,
    password: form.password,
    password_confirmation: form.passwordConfirmation,
    institute_id: Number(form.instituteId),
    area_ids: form.areaIds,
  };
}
