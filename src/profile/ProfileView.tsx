import ArrowBack from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { VisuallyHidden } from '../components/VisuallyHidden';
import type { LoadState } from '../hooks/useLoad';
import { READ_TITLE_SX } from './readTitle';

function BackLink({
  to,
  label,
  plain,
}: {
  to: string;
  label: string;
  /** O link simples e sublinhado das outras telas; sem ele, o botão de texto com a seta. */
  plain: boolean;
}) {
  if (plain) {
    return (
      <Link component={RouterLink} to={to} sx={{ alignSelf: 'flex-start' }}>
        {label}
      </Link>
    );
  }
  return (
    <Button
      component={RouterLink}
      to={to}
      startIcon={<ArrowBack />}
      sx={{ alignSelf: 'flex-start' }}
    >
      {label}
    </Button>
  );
}

interface ProfileViewProps<T> {
  /** Para onde o "Voltar" leva. */
  backPath: string;
  /** O texto do link de voltar, quando ele diz para onde leva; o padrão é "Voltar". */
  backLabel?: string;
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
  /** Troca o `<h1>` simples do título por um cabeçalho próprio, que deve conter o `<h1>`. */
  heading?: (data: T) => ReactNode;
  /**
   * O layout dos perfis de pessoas (o do aluno e o do professor): título h1 igual nos dois, botão
   * de voltar com seta, repetido no fim da leitura, carregamento anunciado e foco no título quando
   * o perfil chega. Sem ele a moldura se comporta como antes, como na tela de atividade.
   */
  profileLayout?: boolean;
  children: (data: T) => ReactNode;
}

/**
 * A moldura de um perfil só para leitura, o do aluno visto pelo professor e o do professor visto
 * pelo aluno: o "Voltar", o título, o esqueleto, o "não encontrado" sem dizer o motivo e o erro
 * com nova tentativa. O conteúdo de cada perfil vem de `children`.
 */
export function ProfileView<T>({
  backPath,
  backLabel = 'Voltar',
  notFoundTitle,
  genericTitle,
  skeletonTestId,
  invalidId,
  profile,
  onRetry,
  title,
  heading,
  profileLayout = false,
  children,
}: ProfileViewProps<T>) {
  const notFound =
    invalidId || (profile.status === 'ready' && profile.data === null);
  const loading = !notFound && profile.status === 'loading';
  const loaded = profile.status === 'ready' && profile.data !== null;
  const container = useRef<HTMLDivElement>(null);
  const titleProps = profileLayout
    ? ({ variant: 'h1', sx: READ_TITLE_SX } as const)
    : ({ variant: 'h4', component: 'h1' } as const);

  // Quando o perfil chega, o foco vai ao título: quem usa leitor de tela ou teclado sabe que a
  // página está pronta e começa a ler de cima.
  useEffect(() => {
    if (!profileLayout || !loaded) return;
    const title = container.current?.querySelector('h1');
    if (!title) return;
    title.setAttribute('tabindex', '-1');
    title.style.outline = 'none';
    title.focus({ preventScroll: true });
  }, [profileLayout, loaded]);

  return (
    <Stack
      ref={container}
      spacing={3}
      aria-busy={profileLayout ? loading : undefined}
      sx={{ maxWidth: 720, mx: 'auto' }}
    >
      <BackLink to={backPath} label={backLabel} plain={!profileLayout} />
      {profileLayout && (
        // A região fica sempre montada: o leitor de tela só anuncia o texto que entra numa região já existente.
        <Box role="status" aria-live="polite">
          {loading && <VisuallyHidden>Carregando perfil</VisuallyHidden>}
        </Box>
      )}
      {notFound && <Typography {...titleProps}>{notFoundTitle}</Typography>}
      {!notFound && profile.status !== 'ready' && (
        <Typography {...titleProps}>{genericTitle}</Typography>
      )}
      {!notFound && profile.status === 'loading' && (
        <Stack spacing={2} data-testid={skeletonTestId} aria-hidden>
          <Skeleton variant="rounded" height={profileLayout ? 96 : 80} />
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
          {heading ? (
            heading(profile.data)
          ) : (
            <Typography {...titleProps}>{title(profile.data)}</Typography>
          )}
          {children(profile.data)}
          {profileLayout && (
            <BackLink to={backPath} label={backLabel} plain={false} />
          )}
        </>
      )}
    </Stack>
  );
}
