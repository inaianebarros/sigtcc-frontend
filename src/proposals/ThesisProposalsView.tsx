import {
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { PagePagination } from '../components/PagePagination';
import { THESIS_PROPOSALS_PAGE_SIZE } from '../services/thesisProposalService';
import type { ThesisProposal } from '../services/thesisProposalService';

interface ThesisProposalsViewProps {
  items: readonly ThesisProposal[];
  /** O total no servidor: até 5 vira uma lista simples, 6 ou mais vira uma tabela paginada. */
  count: number;
  page: number;
  onPage: (page: number) => void;
  /** As ações de uma proposta (editar e remover); sem elas a leitura é só de exibição. */
  renderActions?: (proposal: ThesisProposal) => ReactNode;
}

/**
 * As propostas de tema (RF56), na ordem em que o servidor as devolve: uma lista até 5 e uma tabela
 * paginada de 5 em 5 a partir de 6, pelo total. Serve ao professor, com ações, e ao aluno, só para
 * leitura.
 */
export function ThesisProposalsView({
  items,
  count,
  page,
  onPage,
  renderActions,
}: ThesisProposalsViewProps) {
  if (count <= THESIS_PROPOSALS_PAGE_SIZE) {
    return (
      <Stack
        component="ul"
        aria-label="Propostas de tema"
        spacing={1}
        sx={{ m: 0, p: 0, listStyle: 'none' }}
      >
        {items.map((proposal) => (
          <Stack
            component="li"
            key={proposal.id}
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              {proposal.title}
            </Typography>
            {renderActions?.(proposal)}
          </Stack>
        ))}
      </Stack>
    );
  }
  return (
    <Stack spacing={2}>
      <TableContainer>
        <Table aria-label="Propostas de tema" size="small">
          <TableHead>
            <TableRow>
              <TableCell>Título</TableCell>
              {renderActions && <TableCell align="right">Ações</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((proposal) => (
              <TableRow key={proposal.id}>
                <TableCell sx={{ overflowWrap: 'anywhere' }}>
                  {proposal.title}
                </TableCell>
                {renderActions && (
                  <TableCell align="right">{renderActions(proposal)}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <PagePagination
        ariaLabel="Paginação das propostas de tema"
        knownCount={count}
        pageSize={THESIS_PROPOSALS_PAGE_SIZE}
        lastPage={Math.max(1, Math.ceil(count / THESIS_PROPOSALS_PAGE_SIZE))}
        page={page}
        onChange={onPage}
      />
    </Stack>
  );
}
