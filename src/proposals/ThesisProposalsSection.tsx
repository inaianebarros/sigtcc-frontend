import {
  Alert,
  Button,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDialogSlot } from '../hooks/useDialogSlot';
import { useFeedback } from '../hooks/useFeedback';
import { useLastReady } from '../hooks/useLastReady';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useReturnToLastPage, useUrlPage } from '../hooks/useUrlPage';
import { ProfileSection } from '../profile/ProfileSection';
import { ApiError, messageForStatus } from '../services/apiError';
import {
  deleteProposal,
  listOwnProposals,
  THESIS_PROPOSALS_PAGE_SIZE,
} from '../services/thesisProposalService';
import type { ThesisProposal } from '../services/thesisProposalService';
import { ThesisProposalDialog } from './ThesisProposalDialog';
import { ThesisProposalsView } from './ThesisProposalsView';

/**
 * A seção "Propostas de tema" da edição do perfil do professor (RF55, RF56, RN41): uma lista
 * paginada de 5 em 5, com a página na URL (RNF30). Adicionar, editar e remover são salvos na hora,
 * fora da barra de salvar do perfil. Remover pede confirmação explícita (RNF21).
 */
export function ThesisProposalsSection() {
  const { notify } = useFeedback();
  const [page, setPage] = useUrlPage();
  const [reload, setReload] = useState(0);
  const formDialog = useDialogSlot<ThesisProposal | undefined>();
  const removeDialog = useDialogSlot<ThesisProposal>();
  const [removing, setRemoving] = useState(false);
  const list = useLoad(() => listOwnProposals(page), `${page}|${reload}`);
  const shown = useLastReady(list);
  const { fallbackPage } = usePageBounds(
    list,
    THESIS_PROPOSALS_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);
  const refresh = () => setReload((current) => current + 1);

  const confirmRemoval = async (proposal: ThesisProposal) => {
    if (removing) return;
    setRemoving(true);
    try {
      await deleteProposal(proposal.id);
      removeDialog.hide();
      notify('Proposta removida.', 'success');
      refresh();
    } catch (error) {
      removeDialog.hide();
      notify(
        error instanceof ApiError ? error.message : messageForStatus(0),
        'error',
      );
      refresh();
    } finally {
      setRemoving(false);
    }
  };

  const formSlot = formDialog.slot;
  const removeSlot = removeDialog.slot;
  // Uma página além da última volta para a última válida: até lá não se desenha uma tabela vazia.
  const correctingPage = fallbackPage !== null;
  return (
    <ProfileSection
      id="propostas-de-tema"
      title="Propostas de tema"
      description="Os trabalhos que você deseja orientar, para os alunos do seu curso os verem."
      aside={
        shown !== null && shown.count > 0 ? (
          <Typography variant="body2" color="text.secondary">
            {shown.count === 1
              ? '1 proposta cadastrada'
              : `${shown.count} propostas cadastradas`}
          </Typography>
        ) : undefined
      }
    >
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => formDialog.show()}
        fullWidth
      >
        Adicionar proposta
      </Button>
      {(list.status === 'loading' || correctingPage) && (
        <LinearProgress aria-label="Carregando as propostas de tema" />
      )}
      {list.status === 'error' && (
        <Stack spacing={2}>
          <Alert severity="error">{list.message}</Alert>
          <Button onClick={refresh} sx={{ alignSelf: 'flex-start' }}>
            Tentar novamente
          </Button>
        </Stack>
      )}
      {list.status === 'ready' && list.data.count === 0 && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => formDialog.show()}
            >
              Cadastrar a primeira
            </Button>
          }
        >
          Você ainda não cadastrou propostas de tema. Cadastre os trabalhos que
          deseja orientar, para os alunos do seu curso as verem.
        </Alert>
      )}
      {shown !== null &&
        list.status !== 'error' &&
        shown.count > 0 &&
        !correctingPage && (
          <ThesisProposalsView
            items={shown.items}
            count={shown.count}
            page={page}
            onPage={setPage}
            renderActions={(proposal) => (
              <Stack direction="row" sx={{ flexShrink: 0 }}>
                <Tooltip title="Editar proposta">
                  <IconButton
                    aria-label={`Editar a proposta "${proposal.title}"`}
                    onClick={() => formDialog.show(proposal)}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remover proposta">
                  <IconButton
                    aria-label={`Remover a proposta "${proposal.title}"`}
                    onClick={() => removeDialog.show(proposal)}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          />
        )}
      {formSlot && (
        <ThesisProposalDialog
          key={`form-${formSlot.openCount}`}
          open={formSlot.open}
          proposal={formSlot.payload}
          onSaved={(editing) => {
            formDialog.hide();
            notify(
              editing ? 'Proposta atualizada.' : 'Proposta cadastrada.',
              'success',
            );
            // Uma proposta nova é a mais recente: o professor a vê na primeira página.
            if (!editing && page !== 1) setPage(1);
            refresh();
          }}
          onClose={formDialog.hide}
          onExited={formDialog.unmount}
        />
      )}
      {removeSlot && (
        <ConfirmDialog
          key={`remove-${removeSlot.openCount}`}
          open={removeSlot.open}
          title="Remover proposta de tema"
          message={`A remoção é definitiva e não pode ser desfeita. Deseja remover a proposta "${removeSlot.payload.title}"?`}
          confirmLabel="Remover proposta"
          cancelLabel="Voltar"
          busy={removing}
          busyLabel="Removendo…"
          onConfirm={() => void confirmRemoval(removeSlot.payload)}
          onCancel={removeDialog.hide}
          onExited={removeDialog.unmount}
        />
      )}
    </ProfileSection>
  );
}
