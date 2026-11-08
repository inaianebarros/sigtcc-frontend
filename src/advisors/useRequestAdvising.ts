import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { paths } from '../navigation/paths';
import { ApiError, messageForStatus } from '../services/apiError';
import {
  getRequestEligibility,
  requestAdvising,
} from '../services/advisorService';

/** Quem o aluno quer pedir como orientador. */
export interface AdvisorToAsk {
  id: number;
  fullName: string;
}

/**
 * O fluxo de solicitar orientação, o mesmo na busca e no perfil do professor (RF12, RN04 e
 * RN05): a elegibilidade que o servidor informa, o diálogo de confirmação e o envio. O frontend
 * não repete as regras: só mostra o que o servidor decidiu. Um 409 quer dizer que a situação
 * mudou, e a tela relê a elegibilidade e, por `onConflict`, o que mais ela mostra.
 */
export function useRequestAdvising({
  onConflict,
}: { onConflict?: () => void } = {}) {
  const [statusReload, setStatusReload] = useState(0);
  const eligibility = useLoad(getRequestEligibility, `status-${statusReload}`);
  const noticeId = useId();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [asking, setAsking] = useState<AdvisorToAsk | null>(null);
  // O nome fica guardado: o texto do diálogo não pode mudar durante a animação de saída.
  const [askedName, setAskedName] = useState('');
  const [sending, setSending] = useState(false);

  const reloadEligibility = () => setStatusReload((current) => current + 1);

  const confirm = async () => {
    if (!asking || sending) return;
    setSending(true);
    try {
      await requestAdvising(asking.id);
      setAsking(null);
      notify(
        'Solicitação enviada. Acompanhe a resposta do professor em “Minha solicitação”.',
        'success',
      );
      navigate(paths.studentRequest);
    } catch (error) {
      setAsking(null);
      notify(
        error instanceof ApiError ? error.message : messageForStatus(0),
        'error',
      );
      if (error instanceof ApiError && error.status === 409) {
        reloadEligibility();
        onConflict?.();
      }
    } finally {
      setSending(false);
    }
  };

  return {
    eligibility,
    noticeId,
    canRequest: eligibility.status === 'ready' && eligibility.data.canRequest,
    /** O aviso que explica o bloqueio; não existe enquanto a elegibilidade ainda carrega. */
    blockedNoticeId: eligibility.status === 'loading' ? null : noticeId,
    reloadEligibility,
    ask: (advisor: AdvisorToAsk) => {
      setAskedName(advisor.fullName);
      setAsking(advisor);
    },
    dialog: {
      open: asking !== null,
      advisorName: askedName,
      busy: sending,
      onCancel: () => setAsking(null),
      onConfirm: confirm,
    },
  };
}
