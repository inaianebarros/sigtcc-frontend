import { Box } from '@mui/material';
import type { ComponentProps, ReactNode } from 'react';

const HIDDEN = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const;

/** Texto só para leitor de tela: some da vista, mas continua na árvore de acessibilidade. */
export function VisuallyHidden({
  children,
  ...rest
}: { children: ReactNode } & ComponentProps<'span'>) {
  return (
    <Box component="span" sx={HIDDEN} {...rest}>
      {children}
    </Box>
  );
}
