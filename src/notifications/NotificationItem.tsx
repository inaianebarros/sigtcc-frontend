import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import {
  Box,
  Button,
  ListItemButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { formatDateTime } from '../formatters/dateTime';
import { formatRelativeTime } from '../formatters/relativeTime';
import type { AppNotification } from '../services/notificationService';
import { detailsOf, groupOf } from './notificationKinds';
import type { NotificationGroup } from './notificationKinds';

const ICONS: Record<NotificationGroup, ReactNode> = {
  advising: <SchoolOutlinedIcon />,
  activity: <AssignmentOutlinedIcon />,
  meeting: <EventOutlinedIcon />,
  other: <NotificationsNoneOutlinedIcon />,
};

interface NotificationItemProps {
  notification: AppNotification;
  read: boolean;
  /** Para onde clicar leva; `null` quando não há destino (a atividade excluída, RF52). */
  destination: string | null;
  onOpen: () => void;
  onMarkRead: () => void;
}

/** O marcador de não lida, em ponto e em texto: a cor sozinha não basta (RNF23). */
function UnreadMarker() {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'primary.main',
        }}
      />
      <Typography
        variant="caption"
        sx={{ fontWeight: 'medium' }}
        color="primary"
      >
        Não lida
      </Typography>
    </Stack>
  );
}

function Details({ notification }: { notification: AppNotification }) {
  const details = detailsOf(notification);
  if (details.length === 0) return null;
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {details.map((detail) => (
        <Typography
          key={detail.kind === 'change' ? detail.field : detail.label}
          component="li"
          variant="body2"
          color="text.secondary"
          sx={{ overflowWrap: 'anywhere' }}
        >
          {detail.kind === 'change'
            ? `${detail.field}: de “${detail.oldValue}” para “${detail.newValue}”`
            : `${detail.label}: ${detail.value}`}
        </Typography>
      ))}
    </Box>
  );
}

/**
 * Uma notificação (RF34): o ícone do grupo, a mensagem do servidor, os detalhes do `payload`
 * (RF52 e RF53), a data relativa com a completa no balão e o marcador de não lida. Clicar nela
 * marca como lida e leva ao destino; o botão "Marcar como lida" marca sem navegar.
 */
export function NotificationItem({
  notification,
  read,
  destination,
  onOpen,
  onMarkRead,
}: NotificationItemProps) {
  const content = (
    <Stack direction="row" spacing={1.5} sx={{ width: '100%' }}>
      <Box aria-hidden sx={{ color: 'text.secondary', pt: 0.25 }}>
        {ICONS[groupOf(notification.type)]}
      </Box>
      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontWeight: read ? 'normal' : 'bold',
            overflowWrap: 'anywhere',
          }}
        >
          {notification.message}
        </Typography>
        <Details notification={notification} />
        <Stack
          direction="row"
          useFlexGap
          sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Tooltip title={formatDateTime(notification.createdAt)}>
            <Typography
              component="time"
              dateTime={notification.createdAt}
              variant="caption"
              color="text.secondary"
            >
              {formatRelativeTime(notification.createdAt)}
            </Typography>
          </Tooltip>
          {!read && <UnreadMarker />}
        </Stack>
      </Stack>
    </Stack>
  );
  return (
    <Box
      component="li"
      sx={{ listStyle: 'none', borderBottom: 1, borderColor: 'divider' }}
    >
      {destination === null ? (
        <Box sx={{ px: 2, py: 1.5 }}>{content}</Box>
      ) : (
        <ListItemButton onClick={onOpen} sx={{ alignItems: 'flex-start' }}>
          {content}
        </ListItemButton>
      )}
      {!read && (
        <Box sx={{ px: 2, pb: 1, pl: 7 }}>
          <Button size="small" onClick={onMarkRead}>
            Marcar como lida
          </Button>
        </Box>
      )}
    </Box>
  );
}
