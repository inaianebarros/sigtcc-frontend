import { useState } from 'react';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import type { LoadState } from '../hooks/useLoad';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { messageOf } from '../services/apiError';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService';
import type {
  AppNotification,
  NotificationPage,
} from '../services/notificationService';

interface FeedQuery {
  limit: number;
  offset: number;
  onlyUnread: boolean;
}

/**
 * Uma lista de notificações (a do painel do sino ou a da página) com a leitura otimista. Marcar
 * como lida atualiza o item e o selo na hora e desfaz se o pedido falhar; "marcar todas" faz o
 * mesmo e relê a lista no fim. Com a lista aberta, um total de não lidas que sobe a relê, sem
 * piscar o esqueleto.
 */
export function useNotificationFeed({ limit, offset, onlyUnread }: FeedQuery) {
  const { count, setCount } = useNotificationCount();
  const { notify } = useFeedback();
  const [reloads, setReloads] = useState(0);
  const reload = () => setReloads((current) => current + 1);

  const [seenCount, setSeenCount] = useState(count);
  if (count !== seenCount) {
    setSeenCount(count);
    if (count > seenCount) reload();
  }

  const queryKey = `${limit}|${offset}|${onlyUnread}`;
  const result = useLoad(
    () => listNotifications({ limit, offset, onlyUnread }),
    `${queryKey}|${reloads}`,
  );
  // A lista já na tela fica enquanto a mesma consulta é relida; outra página ou filtro mostra o
  // esqueleto.
  const [kept, setKept] = useState<{
    key: string;
    page: NotificationPage;
  } | null>(null);
  const [readIds, setReadIds] = useState<ReadonlySet<number>>(new Set());
  const [allRead, setAllRead] = useState(false);
  if (result.status === 'ready' && result.data !== kept?.page) {
    setKept({ key: queryKey, page: result.data });
    // O servidor é a verdade: o que foi lido na tela já vem na resposta nova.
    setReadIds(new Set());
    setAllRead(false);
  }
  const showKept =
    result.status !== 'ready' && kept !== null && kept.key === queryKey;
  const shown: LoadState<NotificationPage> = showKept
    ? { status: 'ready', data: kept.page }
    : result;

  const isRead = (notification: AppNotification) =>
    notification.isRead || allRead || readIds.has(notification.id);

  const markRead = async (notification: AppNotification) => {
    if (isRead(notification)) return;
    setReadIds((current) => new Set(current).add(notification.id));
    setCount((current) => Math.max(0, current - 1));
    try {
      await markNotificationRead(notification.id);
    } catch (error) {
      setReadIds((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
      setCount((current) => current + 1);
      notify(messageOf(error), 'error');
    }
  };

  const markAllRead = async () => {
    const before = count;
    setAllRead(true);
    setCount(() => 0);
    try {
      await markAllNotificationsRead();
      reload();
    } catch (error) {
      setAllRead(false);
      setCount(() => before);
      notify(messageOf(error), 'error');
    }
  };

  return { state: shown, isRead, markRead, markAllRead, reload };
}
