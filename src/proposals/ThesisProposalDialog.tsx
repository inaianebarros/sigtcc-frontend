import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useId, useState } from 'react';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { ApiError, messageForStatus } from '../services/apiError';
import {
  createProposal,
  PROPOSAL_TITLE_MAX,
  updateProposal,
} from '../services/thesisProposalService';
import type { ThesisProposal } from '../services/thesisProposalService';
import { titleProblem } from './thesisProposalForm';

interface ThesisProposalDialogProps {
  open: boolean;
  /** A proposta que se edita; sem ela o diálogo cadastra uma nova. */
  proposal?: ThesisProposal;
  onSaved: (editing: boolean) => void;
  onClose: () => void;
  onExited: () => void;
}

/**
 * O diálogo de adicionar e editar uma proposta de tema (RF55, RN41): o título de 5 a 150
 * caracteres, os erros do servidor em português junto do campo e o aviso de alterações não salvas
 * (RNF28). A ação é salva na hora, fora do formulário do perfil. Quem usa troca a `key` a cada
 * abertura.
 */
export function ThesisProposalDialog({
  open,
  proposal,
  onSaved,
  onClose,
  onExited,
}: ThesisProposalDialogProps) {
  const id = useId();
  const editing = proposal !== undefined;
  const original = proposal?.title.trim() ?? '';
  const [title, setTitle] = useState(original);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const trimmed = title.trim();
  const problem = titleProblem(title);
  const pending = trimmed !== original;
  // Um título curto só é apontado depois que o campo perde o foco (não se cobra enquanto digita);
  // um título longo demais é apontado na hora.
  const showProblem =
    problem !== null && (touched || trimmed.length > PROPOSAL_TITLE_MAX);
  const shownProblem = showProblem ? problem : serverError;
  const { requestClose, dialogs } = useDiscardGuard({
    pending,
    open,
    busy: submitting,
    onClose,
  });

  const submit = async () => {
    if (submitting || problem || !pending) return;
    setSubmitting(true);
    setServerError(null);
    setFailure(null);
    try {
      if (proposal) await updateProposal(proposal.id, trimmed);
      else await createProposal(trimmed);
      // O diálogo está fechando: o envio segue marcado como em curso até ele sair.
      onSaved(editing);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiError && error.fieldErrors.title) {
        setServerError(error.fieldErrors.title);
      } else {
        setFailure(
          error instanceof ApiError ? error.message : messageForStatus(0),
        );
      }
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        aria-labelledby={`${id}-title`}
        fullWidth
        maxWidth="sm"
        slotProps={{ transition: { onExited } }}
      >
        <Box
          component="form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            void submit();
          }}
        >
          <DialogTitle id={`${id}-title`}>
            {editing ? 'Editar proposta de tema' : 'Adicionar proposta de tema'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <PendingChangesNotice
                visible={pending}
                actionLabel={editing ? 'Salvar' : 'Adicionar'}
              />
              <TextField
                label="Título da proposta"
                required
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setServerError(null);
                }}
                onBlur={() => setTouched(true)}
                disabled={submitting}
                error={Boolean(shownProblem)}
                helperText={shownProblem ?? undefined}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ alignSelf: 'flex-end' }}
              >
                {trimmed.length}/{PROPOSAL_TITLE_MAX}
              </Typography>
              {failure && <Alert severity="error">{failure}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={requestClose} disabled={submitting}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={Boolean(problem) || !pending || submitting}
            >
              {submitting ? 'Salvando…' : editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      {dialogs}
    </>
  );
}
