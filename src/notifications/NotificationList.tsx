import { Alert, Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { useSession } from '../hooks/useSession';
import { NotificationItem } from './NotificationItem';
import { destinationOf } from './notificationKinds';
import type { useNotificationFeed } from './useNotificationFeed';

interface NotificationListProps {
  feed: ReturnType<typeof useNotificationFeed>;
  /** O estado vazio muda com o filtro: "Você não tem notificações" ou "Nenhuma notificação não lida". */
  emptyText: string;
  /** Chamado ao navegar para o destino de uma notificação, como o painel do sino se fechar. */
  onNavigate?: () => void;
}

/** A lista de notificações com os estados: esqueleto, erro com nova tentativa, vazio e itens. */
export function NotificationList({
  feed,
  emptyText,
  onNavigate,
}: NotificationListProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const userType = user?.type === 'teacher' ? 'teacher' : 'student';
  const { state } = feed;

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <Stack spacing={1} role="status" data-testid="notifications-skeleton">
        <VisuallyHidden>Carregando as notificações…</VisuallyHidden>
        <Skeleton variant="rounded" height={64} aria-hidden />
        <Skeleton variant="rounded" height={64} aria-hidden />
        <Skeleton variant="rounded" height={64} aria-hidden />
      </Stack>
    );
  }
  if (state.status === 'error') {
    return (
      <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {state.message}
        </Alert>
        <Button onClick={feed.reload}>Tentar novamente</Button>
      </Stack>
    );
  }
  if (state.data.items.length === 0) {
    return <Typography color="text.secondary">{emptyText}</Typography>;
  }
  return (
    <Box
      component="ul"
      aria-label="Notificações"
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {state.data.items.map((notification) => {
        const destination = destinationOf(notification, userType);
        return (
          <NotificationItem
            key={notification.id}
            notification={notification}
            read={feed.isRead(notification)}
            destination={destination}
            onMarkRead={() => void feed.markRead(notification)}
            onOpen={() => {
              void feed.markRead(notification);
              if (destination !== null) {
                navigate(destination);
                onNavigate?.();
              }
            }}
          />
        );
      })}
    </Box>
  );
}
