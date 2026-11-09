import {
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { PagePagination } from '../components/PagePagination';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { usePageBounds } from '../hooks/usePageBounds';
import {
  PAGE_PARAM,
  useReturnToLastPage,
  useUrlPage,
} from '../hooks/useUrlPage';
import { NotificationList } from '../notifications/NotificationList';
import { useNotificationFeed } from '../notifications/useNotificationFeed';
import { NOTIFICATIONS_PAGE_SIZE } from '../services/notificationService';

/** O parâmetro da URL do filtro "Somente não lidas" (RNF30); a página fica em `pagina`. */
const UNREAD_PARAM = 'nao-lidas';

/**
 * A lista completa de notificações (RF34), paginada, com o filtro "Somente não lidas". A página e
 * o filtro ficam na URL (RNF30). A tela se abre pelo sino, não pelo menu lateral.
 */
export function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyUnread = searchParams.get(UNREAD_PARAM) === '1';
  const [page, setPage] = useUrlPage();
  const { count } = useNotificationCount();
  const feed = useNotificationFeed({
    limit: NOTIFICATIONS_PAGE_SIZE,
    offset: (page - 1) * NOTIFICATIONS_PAGE_SIZE,
    onlyUnread,
  });
  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    feed.state,
    NOTIFICATIONS_PAGE_SIZE,
    page,
  );
  useReturnToLastPage(fallbackPage, page, setPage);

  const changeFilter = (checked: boolean) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      if (checked) params.set(UNREAD_PARAM, '1');
      else params.delete(UNREAD_PARAM);
      return params;
    });

  return (
    <Stack spacing={2} sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" component="h1">
        Notificações
      </Typography>
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
        <FormControlLabel
          control={
            <Checkbox
              checked={onlyUnread}
              onChange={(event) => changeFilter(event.target.checked)}
            />
          }
          label="Somente não lidas"
        />
        <Button disabled={count === 0} onClick={() => void feed.markAllRead()}>
          Marcar todas como lidas
        </Button>
      </Stack>
      <NotificationList
        feed={feed}
        emptyText={
          onlyUnread
            ? 'Nenhuma notificação não lida.'
            : 'Você não tem notificações.'
        }
      />
      <PagePagination
        ariaLabel="Paginação das notificações"
        knownCount={knownCount}
        pageSize={NOTIFICATIONS_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={setPage}
      />
    </Stack>
  );
}
