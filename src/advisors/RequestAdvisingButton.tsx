import { Button } from '@mui/material';
import type { AdvisorToAsk } from './useRequestAdvising';

interface RequestAdvisingButtonProps {
  advisor: AdvisorToAsk & { isAvailable: boolean };
  /** Verdadeiro quando o servidor disse que o aluno pode solicitar. */
  canRequest: boolean;
  /** O aviso do topo que explica por que o aluno não pode solicitar agora. */
  blockedNoticeId: string | null;
  /** O texto que explica que este professor não está disponível, quando é o caso. */
  unavailableId: string;
  onRequest: (advisor: AdvisorToAsk) => void;
}

/**
 * O botão de solicitar orientação. A regra de bloqueio é uma só (RN26 e RN29): fica desabilitado
 * quando o servidor diz que o aluno não pode solicitar ou quando o professor não está disponível,
 * e os dois motivos ficam sempre visíveis e ligados ao botão.
 */
export function RequestAdvisingButton({
  advisor,
  canRequest,
  blockedNoticeId,
  unavailableId,
  onRequest,
}: RequestAdvisingButtonProps) {
  const describedBy = [
    canRequest ? null : blockedNoticeId,
    advisor.isAvailable ? null : unavailableId,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Button
      variant="contained"
      disabled={!canRequest || !advisor.isAvailable}
      aria-describedby={describedBy || undefined}
      onClick={() => onRequest(advisor)}
    >
      Solicitar orientação
    </Button>
  );
}
