import type { UserType } from '../types/session';

export interface NavigationItem {
  label: string;
  path: string;
  requiresActiveAdvising?: { reason: string };
}

export interface Area {
  userType: UserType;
  path: string;
  title: string;
  items: readonly NavigationItem[];
}

export const areas: readonly Area[] = [
  {
    userType: 'student',
    path: '/aluno',
    title: 'Área do Aluno',
    items: [
      { label: 'Orientadores', path: '/aluno/orientadores' },
      { label: 'Minha solicitação', path: '/aluno/solicitacao' },
      { label: 'Meu perfil', path: '/aluno/perfil' },
    ],
  },
  {
    userType: 'teacher',
    path: '/professor',
    title: 'Área do Professor',
    items: [
      { label: 'Solicitações', path: '/professor/solicitacoes' },
      { label: 'Meu perfil', path: '/professor/perfil' },
    ],
  },
  {
    userType: 'admin',
    path: '/admin',
    title: 'Área do Administrador',
    items: [],
  },
];
