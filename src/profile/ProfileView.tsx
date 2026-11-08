import {
  Alert,
  Button,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { LoadState } from '../hooks/useLoad';

interface ProfileViewProps<T> {
  /** Para onde o "Voltar" leva. */
  backPath: string;
  /** O título do aluno ou do professor que não existe: um id inválido ou um 404. */
  notFoundTitle: string;
  /** O título geral enquanto o perfil carrega e quando ele falha: o nome só chega com o perfil. */
  genericTitle: string;
  skeletonTestId: string;
  /** O id da URL não é um inteiro: a tela mostra "não encontrado" sem ter chamado a API. */
  invalidId: boolean;
  /** `null` é o 404, que o servidor responde igual para qualquer caso (RN28 e RN32). */
  profile: LoadState<T | null>;
  onRetry: () => void;
  /** O título da página já carregada: o nome da pessoa. */
  title: (data: T) => string;
  children: (data: T) => ReactNode;
}

/**
 * A moldura de um perfil só para leitura, o do aluno visto pelo professor e o do professor visto
 * pelo aluno: o "Voltar", o título, o esqueleto, o "não encontrado" sem dizer o motivo e o erro
 * com nova tentativa. O conteúdo de cada perfil vem de `children`.
 */
export function ProfileView<T>({
  backPath,
  notFoundTitle,
  genericTitle,
  skeletonTestId,
  invalidId,
  profile,
  onRetry,
  title,
  children,
}: ProfileViewProps<T>) {
  const notFound =
    invalidId || (profile.status === 'ready' && profile.data === null);
  return (
    <Stack spacing={3} sx={{ maxWidth: 720, mx: 'auto' }}>
      <Link
        component={RouterLink}
        to={backPath}
        sx={{ alignSelf: 'flex-start' }}
      >
        Voltar
      </Link>
      {notFound && (
        <Typography variant="h4" component="h1">
          {notFoundTitle}
        </Typography>
      )}
      {!notFound && profile.status !== 'ready' && (
        <Typography variant="h4" component="h1">
          {genericTitle}
        </Typography>
      )}
      {!notFound && profile.status === 'loading' && (
        <Stack spacing={2} data-testid={skeletonTestId} aria-hidden>
          <Skeleton variant="rounded" height={80} />
          <Skeleton variant="rounded" height={120} />
        </Stack>
      )}
      {!notFound && profile.status === 'error' && (
        <Stack spacing={2}>
          <Alert severity="error">{profile.message}</Alert>
          <Button onClick={onRetry} sx={{ alignSelf: 'flex-start' }}>
            Tentar novamente
          </Button>
        </Stack>
      )}
      {profile.status === 'ready' && profile.data !== null && (
        <>
          <Typography variant="h4" component="h1">
            {title(profile.data)}
          </Typography>
          {children(profile.data)}
        </>
      )}
    </Stack>
  );
}
