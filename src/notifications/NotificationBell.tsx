import NotificationsIcon from '@mui/icons-material/Notifications';
import {
  Badge,
  Button,
  IconButton,
  Link,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useSession } from '../hooks/useSession';
import { notificationsPathFor } from '../navigation/paths';
import { PANEL_SIZE } from '../services/notificationService';
import { NotificationList } from './NotificationList';
import { useNotificationFeed } from './useNotificationFeed';

const BADGE_MAX = 99;

function unreadLabel(count: number): string {
  return `Notificações, ${count} ${count === 1 ? 'não lida' : 'não lidas'}`;
}

/** O conteúdo do painel do sino: as mais recentes, "Marcar todas como lidas" e "Ver todas". */
function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { user } = useSession();
  const { count } = useNotificationCount();
  const feed = useNotificationFeed({
    limit: PANEL_SIZE,
    offset: 0,
    onlyUnread: false,
  });
  const allPath = notificationsPathFor(
    user?.type === 'teacher' ? 'teacher' : 'student',
  );
  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      <Stack
        direction="row"
        useFlexGap
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h6" component="h2">
          Notificações
        </Typography>
        <Button
          size="small"
          disabled={count === 0}
          onClick={() => void feed.markAllRead()}
        >
          Marcar todas como lidas
        </Button>
      </Stack>
      <NotificationList
        feed={feed}
        emptyText="Você não tem notificações."
        onNavigate={onClose}
      />
      <Link
        component={RouterLink}
        to={allPath}
        onClick={onClose}
        sx={{ alignSelf: 'flex-start' }}
      >
        Ver todas
      </Link>
    </Stack>
  );
}

/**
 * O sino do cabeçalho (RF34), só para aluno e professor: o selo de não lidas ("99+" acima de 99), o
 * rótulo "Notificações, N não lidas" e o painel com as mais recentes, em largura total no celular.
 */
export function NotificationBell() {
  const { count } = useNotificationCount();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton
        color="inherit"
        aria-label={unreadLabel(count)}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <Badge badgeContent={count} max={BADGE_MAX} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'Notificações',
            sx: {
              width: { xs: '100%', sm: 440 },
              maxWidth: '100%',
              maxHeight: '80vh',
            },
          },
        }}
      >
        <NotificationPanel onClose={() => setAnchor(null)} />
      </Popover>
    </>
  );
}
