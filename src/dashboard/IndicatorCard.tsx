import { Paper, Typography } from '@mui/material';
import { useId } from 'react';

interface IndicatorCardProps {
  label: string;
  value: number;
  /** Destaca o número em vermelho, como o das atrasadas, mas o rótulo em texto é o que o diz. */
  alert?: boolean;
}

/** Um indicador da Dashboard: o rótulo em texto e o número calculado pelo servidor. */
export function IndicatorCard({
  label,
  value,
  alert = false,
}: IndicatorCardProps) {
  const id = useId();
  return (
    <Paper
      variant="outlined"
      role="group"
      aria-labelledby={id}
      sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      <Typography id={id} variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h4"
        component="p"
        color={alert && value > 0 ? 'error' : 'text.primary'}
      >
        {value}
      </Typography>
    </Paper>
  );
}
