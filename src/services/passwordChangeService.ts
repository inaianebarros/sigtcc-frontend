import { httpClient } from './httpClient';
import { tokenStore } from './tokenStore';

export interface PasswordChange {
  current_password: string;
  password: string;
  password_confirmation: string;
}

/**
 * Troca a senha de quem está conectado (RF06). O servidor encerra as outras sessões (RN27) e
 * devolve um token novo para este dispositivo, que passa a valer no lugar do antigo.
 */
export async function changePassword(change: PasswordChange): Promise<void> {
  const { access_token } = await httpClient.post<{ access_token: string }>(
    '/auth/change-password',
    change,
  );
  tokenStore.set(access_token);
}
