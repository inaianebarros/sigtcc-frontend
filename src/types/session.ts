export type UserType = 'student' | 'teacher' | 'admin';

export interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  type: UserType;
}
