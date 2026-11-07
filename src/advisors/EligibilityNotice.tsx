import { Alert, Button, Link, Skeleton } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { LoadState } from '../hooks/useLoad';
import { paths } from '../navigation/paths';
import type { RequestEligibility } from '../services/advisorService';
import { blockedMessage } from './blockedMessages';

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
    return (
      <Alert id={id} severity="info">
        {blockedMessage(eligibility.data.blockedReason)}{' '}
        <Link component={RouterLink} to={paths.studentRequest}>
          Ver minha solicitação
        </Link>
      </Alert>
    );
  }
  return null;
}
