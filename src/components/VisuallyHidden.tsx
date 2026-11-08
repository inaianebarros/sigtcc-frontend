import { Box } from '@mui/material';
import type { ReactNode } from 'react';

/** Texto só para o leitor de tela: some da vista, mas continua na árvore de acessibilidade. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        border: 0,
        clip: 'rect(0 0 0 0)',
        height: '1px',
        margin: '-1px',
        overflow: 'hidden',
        padding: 0,
        position: 'absolute',
        whiteSpace: 'nowrap',
        width: '1px',
      }}
    >
      {children}
    </Box>
  );
}
