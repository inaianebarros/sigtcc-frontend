import { Chip } from '@mui/material';
import type { MeetingSituation } from '../services/meetingService';
import { SITUATIONS } from './situationDisplay';

/**
 * A situação da reunião: etiqueta com texto e ícone, nunca só cor. A situação vem derivada do
 * servidor; a tela só a mostra.
 */
export function SituationChip({ situation }: { situation: MeetingSituation }) {
  const { label, icon, color } = SITUATIONS[situation];
  return (
    <Chip
      label={label}
      icon={icon}
      variant="outlined"
      size="small"
      color={color}
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
