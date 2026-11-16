import { Chip } from '@mui/material';
import type { AdvisingRequestStatus } from '../services/advisorService';
import { statusDisplay } from './requestStatusDisplay';

/**
 * A situação da solicitação, com texto e ícone. A cor é opcional (a lista do aluno a usa para o
 * alerta e o teal): o texto e o ícone dizem a situação, nunca a cor.
 */
export function RequestStatusChip({
  status,
  color = 'default',
}: {
  status: AdvisingRequestStatus;
  color?: 'default' | 'primary' | 'warning';
}) {
  const { label, icon } = statusDisplay(status);
  return (
    <Chip
      variant="outlined"
      color={color}
      icon={icon}
      label={label}
      sx={{
        color: 'text.primary',
        '& .MuiChip-icon': {
          color: (theme) =>
            color === 'default'
              ? theme.palette.text.secondary
              : theme.palette[color].main,
        },
      }}
    />
  );
}
