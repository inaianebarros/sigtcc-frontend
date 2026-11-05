import { Box, CircularProgress } from '@mui/material';

export function LoadingIndicator() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress aria-label="Carregando" />
    </Box>
  );
}
