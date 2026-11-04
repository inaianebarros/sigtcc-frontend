import { httpClient, renewAccessToken } from './httpClient';
import { tokenStore } from './tokenStore';
import type { SessionUser, UserType } from '../types/session';

interface ApiUser {
  id: number;
  full_name: string;
  email: string;
  type: UserType;
}

interface LoginResponse {
  access_token: string;
  user: ApiUser;
}

function toSessionUser(user: ApiUser): SessionUser {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    type: user.type,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<SessionUser> {
  const response = await httpClient.post<LoginResponse>('/auth/login', {
    email,
    password,
  });
  tokenStore.set(response.access_token);
  return toSessionUser(response.user);
}

export async function restoreSession(): Promise<SessionUser | null> {
  if (!(await renewAccessToken())) return null;
  try {
    return toSessionUser(await httpClient.get<ApiUser>('/auth/me'));
  } catch {
    tokenStore.clear();
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await httpClient.post('/auth/logout');
  } finally {
    tokenStore.clear();
  }
}
