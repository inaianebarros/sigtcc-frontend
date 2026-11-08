import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function ReadOnlyFacts({
  facts,
}: {
  facts: readonly (readonly [label: string, value: ReactNode])[];
}) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'max-content 1fr' },
        columnGap: 3,
        rowGap: 1,
      }}
    >
      {facts.map(([label, value]) => (
        <Box key={label} sx={{ display: 'contents' }}>
          <Typography component="dt" color="text.secondary">
            {label}
          </Typography>
          <Typography component="dd" sx={{ m: 0 }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
