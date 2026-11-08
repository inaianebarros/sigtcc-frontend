import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

interface DiscardGuardOptions {
  /** Há alteração não salva (RNF28). */
  pending: boolean;
  /** O diálogo está aberto: a guarda de navegação só vale enquanto ele está. */
  open: boolean;
  /** Um envio em andamento: o diálogo não fecha. */
  busy: boolean;
  onClose: () => void;
}

/**
 * Tudo o que um diálogo com formulário faz para não perder o que foi digitado (RNF28): fechar pede
 * confirmação quando há alteração, e sair da tela por navegação interna, voltar ou recarregar a
 * aba também. `dialogs` são as duas confirmações e vão ao lado do diálogo.
 */
export function useDiscardGuard({
  pending,
  open,
  busy,
  onClose,
}: DiscardGuardOptions) {
  const [confirming, setConfirming] = useState(false);
  const blocker = useUnsavedChangesGuard(pending && open);

  const requestClose = () => {
    if (busy) return;
    if (pending) setConfirming(true);
    else onClose();
  };

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirming}
        title="Descartar alterações?"
        message="Você tem alterações que ainda não foram salvas. Se fechar agora, elas serão perdidas."
        confirmLabel="Sair sem salvar"
        cancelLabel="Continuar editando"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onClose();
        }}
      />
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
  return { requestClose, dialogs };
}
