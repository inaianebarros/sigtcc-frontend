import { Alert, Button, Link, Skeleton } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { LoadState } from '../hooks/useLoad';
import { paths } from '../navigation/paths';
import type {
  BlockedReason,
  RequestEligibility,
} from '../services/advisorService';

const UNKNOWN_BLOCK_MESSAGE =
  'No momento você não pode solicitar uma orientação.';

const BLOCKED_MESSAGES: Record<BlockedReason, string> = {
  active_advising:
    'Você já tem um orientador ativo, por isso não pode solicitar outra orientação agora.',
  pending_request:
    'Você já tem uma solicitação aguardando resposta, por isso não pode enviar outra agora.',
};

interface EligibilityNoticeProps {
  id: string;
  eligibility: LoadState<RequestEligibility>;
  onRetry: () => void;
}

/** Explica, sempre visível, por que os botões de solicitar estão desabilitados. */
export function EligibilityNotice({
  id,
  eligibility,
  onRetry,
}: EligibilityNoticeProps) {
  if (eligibility.status === 'loading') {
    return (
      <Skeleton
        variant="rounded"
        height={48}
        data-testid="eligibility-skeleton"
        aria-hidden
      />
    );
  }
  if (eligibility.status === 'error') {
    return (
      <Alert
        id={id}
        severity="warning"
        action={<Button onClick={onRetry}>Verificar novamente</Button>}
      >
        Não foi possível verificar se você pode solicitar orientação agora.
      </Alert>
    );
  }
  if (eligibility.status === 'ready' && !eligibility.data.canRequest) {
    const reason = eligibility.data.blockedReason;
    return (
      <Alert id={id} severity="info">
        {reason ? BLOCKED_MESSAGES[reason] : UNKNOWN_BLOCK_MESSAGE}{' '}
        <Link component={RouterLink} to={paths.studentRequest}>
          Ver minha solicitação
        </Link>
      </Alert>
    );
  }
  return null;
}
