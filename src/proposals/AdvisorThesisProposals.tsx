import {
  Alert,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { useLastReady } from '../hooks/useLastReady';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useReturnToLastPage, useUrlPage } from '../hooks/useUrlPage';
import {
  listAdvisorProposals,
  THESIS_PROPOSALS_PAGE_SIZE,
} from '../services/thesisProposalService';
import { ThesisProposalsView } from './ThesisProposalsView';

/**
 * As propostas de tema de um professor no perfil visto pelo aluno (RF56, RN42), só para leitura: a
 * mesma lista (até 5) ou tabela paginada (6 ou mais) do perfil do professor, com a página na URL
 * (RNF30). Sem propostas a seção inteira some, sem estado vazio. Aparece mesmo com o professor
 * indisponível (RN26).
 */
export function AdvisorThesisProposals({ teacherId }: { teacherId: number }) {
  const [page, setPage] = useUrlPage();
  const [reload, setReload] = useState(0);
  const list = useLoad(
    () => listAdvisorProposals(teacherId, page),
    `${teacherId}|${page}|${reload}`,
  );
  const shown = useLastReady(list);
  const { fallbackPage } = usePageBounds(
    list,
    THESIS_PROPOSALS_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);

  if (list.status === 'error') {
    return (
      <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Alert severity="error" sx={{ alignSelf: 'stretch' }}>
          Não foi possível carregar as propostas de tema deste professor.
        </Alert>
        <Button onClick={() => setReload((current) => current + 1)}>
          Tentar novamente
        </Button>
      </Stack>
    );
  }
  if (shown === null) {
    return list.status === 'loading' ? (
      <LinearProgress aria-label="Carregando as propostas de tema" />
    ) : null;
  }
  if (shown.count === 0) return null;
  const lastPage = Math.max(
    1,
    Math.ceil(shown.count / THESIS_PROPOSALS_PAGE_SIZE),
  );
  return (
    <Stack
      component="section"
      aria-labelledby="advisor-proposals-title"
      spacing={1}
    >
      <Typography id="advisor-proposals-title" variant="h6" component="h2">
        Propostas de tema
      </Typography>
      {fallbackPage === null && (
        <ThesisProposalsView
          items={shown.items}
          count={shown.count}
          page={page}
          onPage={setPage}
        />
      )}
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {shown.count > THESIS_PROPOSALS_PAGE_SIZE
            ? `Página ${Math.min(page, lastPage)} de ${lastPage}.`
            : ''}
        </span>
      </VisuallyHidden>
    </Stack>
  );
}
