import { Box, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';

/** Uma seção do detalhe da atividade: a região nomeada pelo título. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Box component="section" aria-labelledby={id}>
      <Stack spacing={1}>
        <Typography id={id} variant="h6" component="h2">
          {title}
        </Typography>
        {children}
      </Stack>
    </Box>
  );
}
