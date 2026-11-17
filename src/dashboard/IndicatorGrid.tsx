import { Box } from '@mui/material';
import type { ReactNode } from 'react';

/**
 * A grade dos cartões de indicadores: duas colunas no celular e três em tela larga. Quando sobra um
 * cartão sozinho na última linha, ele ocupa a linha toda, para a grade não ficar com um buraco.
 */
export function IndicatorGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(3, minmax(0, 1fr))',
        },
        '& > :last-of-type:nth-of-type(odd)': {
          gridColumn: { xs: 'span 2', md: 'auto' },
        },
        '& > :last-of-type:nth-of-type(3n + 1)': {
          gridColumn: { md: 'span 3' },
        },
      }}
    >
      {children}
    </Box>
  );
}
