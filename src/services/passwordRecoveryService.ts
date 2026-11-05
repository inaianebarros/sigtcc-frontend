import { httpClient } from './httpClient';

export interface PasswordReset {
  uid: string;
  token: string;
  password: string;
  password_confirmation: string;
}

export function requestPasswordReset(email: string): Promise<void> {
  return httpClient.post<void>('/auth/forgot-password', { email });
}

export function resetPassword(reset: PasswordReset): Promise<void> {
  return httpClient.post<void>('/auth/reset-password', reset);
}
