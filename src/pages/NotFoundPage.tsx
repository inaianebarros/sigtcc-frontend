import { Link as MuiLink, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Página não encontrada
      </Typography>
      <MuiLink component={Link} to="/">
        Voltar para o início
      </MuiLink>
    </>
  );
}
