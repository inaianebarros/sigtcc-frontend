import { Typography } from '@mui/material';

export function AreaPage({ title }: { title: string }) {
  return (
    <Typography variant="h4" component="h1">
      {title}
    </Typography>
  );
}
