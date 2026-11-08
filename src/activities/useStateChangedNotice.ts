import { useFeedback } from '../hooks/useFeedback';
import { useSession } from '../hooks/useSession';

export const ADVISING_ENDED_MESSAGE = 'A orientação foi encerrada.';

/**
 * O aviso de que a situação mudou desde que a tela a leu (404 e 409). O servidor responde 404
 * quando a orientação já não está ativa: a sessão é atualizada, para o menu reagir. O 409 traz a
 * própria mensagem do servidor, como a de uma atividade concluída.
 */
export function useStateChangedNotice() {
  const { notify } = useFeedback();
  const { refreshUser } = useSession();
  return (
    error: { status: number; message: string },
    notFoundMessage = ADVISING_ENDED_MESSAGE,
  ) => {
    if (error.status === 404) {
      notify(notFoundMessage, 'error');
      void refreshUser();
    } else {
      notify(error.message, 'error');
    }
  };
}
