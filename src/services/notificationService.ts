import { httpClient } from './httpClient';

/** O painel do sino mostra as mais recentes; a página mostra a lista completa, paginada. */
export const PANEL_SIZE = 10;
export const NOTIFICATIONS_PAGE_SIZE = 20;

/** O objeto a que a notificação se refere, para o link: o tipo e o id que o servidor guardou. */
export interface NotificationReference {
  type: string;
  id: number;
}

export interface AppNotification {
  id: number;
  /** Pode ser um tipo que esta versão da tela não conhece: ela não quebra com ele. */
  type: string;
  /** O texto pronto em português, montado no servidor: a tela não monta texto próprio. */
  message: string;
  /** O retrato do evento no momento em que ocorreu, com a estrutura de cada tipo. */
  payload: Record<string, unknown>;
  reference: NotificationReference | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  count: number;
}

interface ApiNotification {
  id: number;
  type: string;
  message: string;
  payload: Record<string, unknown> | null;
  reference: NotificationReference | null;
  is_read: boolean;
  created_at: string;
}

function notificationFrom(item: ApiNotification): AppNotification {
  return {
    id: item.id,
    type: item.type,
    message: item.message,
    payload: item.payload ?? {},
    reference: item.reference,
    isRead: item.is_read,
    createdAt: item.created_at,
  };
}

/** As notificações de quem entrou, da mais nova para a mais antiga (RF34). */
export async function listNotifications({
  limit,
  offset,
  onlyUnread,
}: {
  limit: number;
  offset: number;
  onlyUnread: boolean;
}): Promise<NotificationPage> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (onlyUnread) params.set('is_read', 'false');
  const response = await httpClient.get<{
    items: ApiNotification[];
    count: number;
  }>(`/notificacoes?${params}`);
  return { items: response.items.map(notificationFrom), count: response.count };
}

/** O total de não lidas, para o selo do sino: uma consulta leve, repetida por polling (ADR 0003). */
export async function getUnreadCount(): Promise<number> {
  const response = await httpClient.get<{ count: number }>(
    '/notificacoes/nao-lidas/contagem',
  );
  return response.count;
}

export async function markNotificationRead(id: number): Promise<void> {
  await httpClient.patch(`/notificacoes/${id}/lida`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await httpClient.patch('/notificacoes/todas-lidas');
}
