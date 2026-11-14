import { Box, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';

/**
 * Uma seção do detalhe da atividade: a região nomeada pelo título. `nested` a usa dentro de outra
 * seção, com o título um nível abaixo.
 */
export function Section({
  title,
  nested = false,
  children,
}: {
  title: string;
  nested?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Box component="section" aria-labelledby={id}>
      <Stack spacing={1}>
        <Typography
          id={id}
          variant={nested ? 'subtitle1' : 'h6'}
          component={nested ? 'h3' : 'h2'}
          sx={nested ? { fontWeight: 'medium' } : undefined}
        >
          {title}
        </Typography>
        {children}
      </Stack>
    </Box>
  );
}
