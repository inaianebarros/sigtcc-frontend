import { Typography } from '@mui/material';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {title}
      </Typography>
      <Typography>Esta tela ainda não está disponível. Em breve.</Typography>
    </>
  );
}
