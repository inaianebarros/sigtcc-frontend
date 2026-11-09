import { Stack, Typography } from '@mui/material';

/** O cabeçalho das Dashboards: o título da tela e a saudação com o nome de quem entrou. */
export function DashboardHeader({ name }: { name: string | null }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="h4" component="h1">
        Dashboard
      </Typography>
      {name && <Typography color="text.secondary">Olá, {name}!</Typography>}
    </Stack>
  );
}
