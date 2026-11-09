import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TimerOffIcon from '@mui/icons-material/TimerOff';
import type { ReactElement } from 'react';
import type { MeetingSituation } from '../services/meetingService';

interface SituationDisplay {
  label: string;
  icon: ReactElement;
  /** A cor da borda e do ícone; o texto fica sempre na cor do texto, para o contraste de 4,5:1. */
  color: 'warning' | 'success' | 'error' | 'info' | 'default';
}

export const SITUATIONS: Record<MeetingSituation, SituationDisplay> = {
  pending: {
    label: 'Pendente',
    icon: <HourglassEmptyIcon />,
    color: 'warning',
  },
  accepted: { label: 'Aceita', icon: <CheckCircleIcon />, color: 'success' },
  rejected: { label: 'Recusada', icon: <BlockIcon />, color: 'error' },
  cancelled: { label: 'Cancelada', icon: <EventBusyIcon />, color: 'default' },
  held: { label: 'Realizada', icon: <TaskAltIcon />, color: 'info' },
  expired: { label: 'Expirada', icon: <TimerOffIcon />, color: 'default' },
};
