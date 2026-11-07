import {
  Alert,
  Button,
  Card,
  CardContent,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useId, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { blockedMessage } from '../advisors/blockedMessages';
import { RequestStatusChip } from '../advisingRequests/requestStatus';
import { formatDate, formatDateTime } from '../formatters/dateTime';
import { useLoad } from '../hooks/useLoad';
import { paths } from '../navigation/paths';
import { useSession } from '../hooks/useSession';
import { getRequestStatus } from '../services/advisorService';
import type { MyRequest, RequestStatus } from '../services/advisorService';

function statusMessage(status: string, hasAdvising: boolean): string {
  switch (status) {
    case 'pending':
      return 'O professor ainda não respondeu.';
    case 'accepted':
      return hasAdvising
        ? 'O professor aceitou a sua solicitação.'
        : 'O professor aceitou a sua solicitação. A orientação já foi encerrada.';
    case 'rejected':
      return 'O professor recusou a solicitação. Você pode solicitar de novo, inclusive ao mesmo professor.';
    case 'unanswered':
      return 'O professor não respondeu dentro do prazo. Você pode solicitar de novo.';
    default:
      return 'Não foi possível identificar a situação desta solicitação.';
  }
}

function RequestCard({
  request,
  hasAdvising,
}: {
  request: MyRequest;
  hasAdvising: boolean;
}) {
  const titleId = useId();
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography id={titleId} variant="h6" component="h2">
            {request.teacher.fullName}
          </Typography>
          <Typography color="text.secondary">
            Enviada em {formatDate(request.requestedAt)}
          </Typography>
          <div role="status" aria-live="polite">
            <RequestStatusChip status={request.status} />
          </div>
          <Typography>{statusMessage(request.status, hasAdvising)}</Typography>
          {request.status === 'pending' && request.expiresAt && (
            <Typography>
              O professor tem até {formatDateTime(request.expiresAt)}, para
              responder.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ActiveAdvising({
  advising,
}: {
  advising: NonNullable<RequestStatus['advising']>;
}) {
  const titleId = useId();
  return (
    <Card component="section" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography id={titleId} variant="h6" component="h2">
            Orientação ativa
          </Typography>
          <Typography>{advising.teacher.fullName}</Typography>
          <Typography color="text.secondary">
            Desde {formatDate(advising.startedAt)}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SearchLink() {
  return (
    <Link component={RouterLink} to={paths.studentAdvisors}>
      Buscar orientadores
    </Link>
  );
}

function Content({ status }: { status: RequestStatus }) {
  const { request, advising, canRequest, blockedReason } = status;
  if (!request && !advising) {
    return (
      <Alert severity="info" action={<SearchLink />}>
        Você ainda não enviou nenhuma solicitação de orientação.
      </Alert>
    );
  }
  return (
    <Stack spacing={2}>
      {request && (
        <RequestCard request={request} hasAdvising={advising !== null} />
      )}
      {advising && <ActiveAdvising advising={advising} />}
      {canRequest ? (
        <SearchLink />
      ) : (
        <Alert severity="info">{blockedMessage(blockedReason)}</Alert>
      )}
    </Stack>
  );
}

export function StudentRequestPage() {
  const { refreshUser } = useSession();
  const [reload, setReload] = useState(0);
  const state = useLoad(getRequestStatus, `status-${reload}`);
  // O que já foi lido fica na tela enquanto a releitura acontece: sem esqueleto piscando.
  const [shown, setShown] = useState<RequestStatus | null>(null);
  if (state.status === 'ready' && state.data !== shown) setShown(state.data);
  const refreshed = useRef(false);
  const lastReload = useRef(0);

  // Sem polling: relê ao voltar para a aba, que é quando o professor pode ter respondido. O foco
  // da janela e a visibilidade da aba costumam chegar juntos, então valem como uma releitura só.
  useEffect(() => {
    const reloadOnReturn = () => {
      const now = Date.now();
      if (now - lastReload.current < 1000) return;
      lastReload.current = now;
      setReload((current) => current + 1);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') reloadOnReturn();
    };
    window.addEventListener('focus', reloadOnReturn);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', reloadOnReturn);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // O que importa para o menu é a orientação ativa: uma solicitação aceita cuja orientação já
  // foi encerrada não habilita nada. Um pedido de relê que falhou é tentado de novo na visita.
  const hasAdvising = shown !== null && shown.advising !== null;
  useEffect(() => {
    if (!hasAdvising || refreshed.current) return;
    refreshed.current = true;
    void refreshUser();
  }, [hasAdvising, refreshUser]);

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Minha solicitação
      </Typography>
      {shown === null && state.status === 'loading' && (
        <Skeleton
          variant="rounded"
          height={160}
          data-testid="request-skeleton"
        />
      )}
      {shown === null && state.status === 'error' && (
        <Stack spacing={2}>
          <Alert severity="error">{state.message}</Alert>
          <Button
            onClick={() => setReload((current) => current + 1)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Tentar novamente
          </Button>
        </Stack>
      )}
      {shown !== null && state.status === 'error' && (
        <Alert
          severity="warning"
          action={
            <Button onClick={() => setReload((current) => current + 1)}>
              Atualizar
            </Button>
          }
        >
          Não foi possível atualizar a situação. O que aparece abaixo pode estar
          desatualizado.
        </Alert>
      )}
      {shown !== null && <Content status={shown} />}
    </Stack>
  );
}
