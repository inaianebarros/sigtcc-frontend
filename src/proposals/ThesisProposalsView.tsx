import { Card, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { PagePagination } from '../components/PagePagination';
import { THESIS_PROPOSALS_PAGE_SIZE } from '../services/thesisProposalService';
import type { ThesisProposal } from '../services/thesisProposalService';

interface ThesisProposalsViewProps {
  items: readonly ThesisProposal[];
  /** O total no servidor: com mais de uma página, a lista ganha o rodapé de paginação. */
  count: number;
  page: number;
  onPage: (page: number) => void;
  /** As ações de uma proposta (editar e remover); sem elas a leitura é só de exibição. */
  renderActions?: (proposal: ThesisProposal) => ReactNode;
}

/**
 * As propostas de tema do professor (RF56), na ordem em que o servidor as devolve: sempre uma lista
 * de cartões, paginada de 5 em 5 no servidor, com "Exibindo 1–5 de 12" e a paginação quando há mais
 * de uma página. Sem números: a lista é da mais recente para a mais antiga e uma proposta nova
 * empurraria todos eles.
 */
export function ThesisProposalsView({
  items,
  count,
  page,
  onPage,
  renderActions,
}: ThesisProposalsViewProps) {
  const lastPage = Math.max(1, Math.ceil(count / THESIS_PROPOSALS_PAGE_SIZE));
  const first = (page - 1) * THESIS_PROPOSALS_PAGE_SIZE + 1;
  const last = first + items.length - 1;
  return (
    <Stack spacing={2}>
      <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {items.map((proposal) => (
          <Card component="li" key={proposal.id} sx={{ p: 1.5 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Typography sx={{ overflowWrap: 'anywhere' }}>
                {proposal.title}
              </Typography>
              {renderActions?.(proposal)}
            </Stack>
          </Card>
        ))}
      </Stack>
      {count > THESIS_PROPOSALS_PAGE_SIZE && (
        <Stack spacing={1}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'center' }}
          >
            Exibindo {first}–{last} de {count}
          </Typography>
          <PagePagination
            ariaLabel="Paginação das propostas de tema"
            knownCount={count}
            pageSize={THESIS_PROPOSALS_PAGE_SIZE}
            lastPage={lastPage}
            page={page}
            onChange={onPage}
          />
        </Stack>
      )}
    </Stack>
  );
}
