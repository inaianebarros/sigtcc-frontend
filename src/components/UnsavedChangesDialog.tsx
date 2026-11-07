import type { Blocker } from 'react-router-dom';
import { ConfirmDialog } from './ConfirmDialog';

export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="Descartar alterações?"
      message="Você tem alterações que ainda não foram salvas. Se sair agora, elas serão perdidas."
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar editando"
      onCancel={() => blocker.state === 'blocked' && blocker.reset()}
      onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
    />
  );
}
