import { Box } from '@mui/material';
import type { ReactNode } from 'react';

/** A grade dos cartões de indicadores: duas colunas no celular e três em tela larga. */
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
      }}
    >
      {children}
    </Box>
  );
}
