import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { PagePagination } from '../components/PagePagination';
import { THESIS_PROPOSALS_PAGE_SIZE } from '../services/thesisProposalService';
import type { ThesisProposal } from '../services/thesisProposalService';

/** A altura de um cartão de título curto e o espaço entre cartões, em rem (acompanham o zoom do texto). */
const CARD_HEIGHT_REM = 3.5;
const CARD_GAP_REM = 0.5;
/** A caixa de várias páginas tem a altura de uma página cheia (5 cartões), em qualquer página. */
const FIXED_BOX_HEIGHT_REM =
  THESIS_PROPOSALS_PAGE_SIZE * CARD_HEIGHT_REM +
  (THESIS_PROPOSALS_PAGE_SIZE - 1) * CARD_GAP_REM;

interface ProposalCardsProps {
  items: readonly ThesisProposal[];
  /** O total no servidor: com mais de uma página a caixa tem altura fixa e há paginação. */
  count: number;
  page: number;
  onPage: (page: number) => void;
}

/**
 * As propostas de tema vistas pelo aluno (RF56, RN42): um cartão só com o título, na ordem do
 * servidor. Até 5 propostas, a caixa se ajusta ao conteúdo. Com mais de uma página, a caixa tem a
 * altura de 5 cartões, para o indicador de páginas ficar no mesmo lugar em todas elas; títulos
 * longos rolam por dentro da caixa, que recebe o foco do teclado.
 */
export function ProposalCards({
  items,
  count,
  page,
  onPage,
}: ProposalCardsProps) {
  const paged = count > THESIS_PROPOSALS_PAGE_SIZE;
  return (
    <Stack spacing={2}>
      <Box
        // Uma região rolável precisa de nome e de foco para ser lida e rolada pelo teclado.
        role={paged ? 'region' : undefined}
        aria-label={paged ? 'Lista de propostas de tema' : undefined}
        tabIndex={paged ? 0 : undefined}
        sx={
          paged
            ? { height: `${FIXED_BOX_HEIGHT_REM}rem`, overflowY: 'auto' }
            : undefined
        }
      >
        <Stack
          component="ul"
          aria-label="Propostas de tema"
          spacing={`${CARD_GAP_REM}rem`}
          sx={{ m: 0, p: 0, listStyle: 'none' }}
        >
          {items.map((proposal) => (
            <Card
              component="li"
              key={proposal.id}
              variant="outlined"
              sx={{ flexShrink: 0, minHeight: `${CARD_HEIGHT_REM}rem` }}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: `${CARD_HEIGHT_REM}rem`,
                  py: 1,
                  '&:last-child': { pb: 1 },
                }}
              >
                <Typography sx={{ overflowWrap: 'anywhere' }}>
                  {proposal.title}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
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
