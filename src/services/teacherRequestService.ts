import { httpClient } from './httpClient';
import type { AdvisingRequestStatus } from './advisorService';

export const REQUESTS_PAGE_SIZE = 20;

/** `all` é "Todas": o servidor recebe a lista sem filtro de situação. */
export type RequestFilter = 'all' | AdvisingRequestStatus;

export interface NamedItem {
  id: number;
  name: string;
}

export interface ReceivedRequest {
  id: number;
  status: AdvisingRequestStatus;
  requestedAt: string;
  respondedAt: string | null;
  /** O prazo para responder; só existe enquanto a solicitação não foi respondida. */
  expiresAt: string | null;
  student: {
    id: number;
    fullName: string;
    course: NamedItem;
    areas: NamedItem[];
  };
}

export interface ReceivedRequestPage {
  items: ReceivedRequest[];
  count: number;
}

interface ApiReceivedRequest {
  id: number;
  status: AdvisingRequestStatus;
  requested_at: string;
  responded_at: string | null;
  expires_at: string | null;
  student: {
    id: number;
    full_name: string;
    course: NamedItem;
    areas: NamedItem[];
  };
}

function toReceivedRequest(item: ApiReceivedRequest): ReceivedRequest {
  return {
    id: item.id,
    status: item.status,
    requestedAt: item.requested_at,
    respondedAt: item.responded_at,
    expiresAt: item.expires_at,
    student: {
      id: item.student.id,
      fullName: item.student.full_name,
      course: item.student.course,
      areas: item.student.areas,
    },
  };
}

export async function listReceivedRequests({
  filter,
  page,
}: {
  filter: RequestFilter;
  page: number;
}): Promise<ReceivedRequestPage> {
  const params = new URLSearchParams();
  if (filter !== 'all') params.set('status', filter);
  params.set('limit', String(REQUESTS_PAGE_SIZE));
  params.set('offset', String((page - 1) * REQUESTS_PAGE_SIZE));
  const response = await httpClient.get<{
    items: ApiReceivedRequest[];
    count: number;
  }>(`/orientacao/solicitacoes?${params}`);
  return {
    count: response.count,
    items: response.items.map(toReceivedRequest),
  };
}

export type AnswerAction = 'accept' | 'reject';

/** A resposta do servidor é a solicitação já atualizada: a tela a usa no lugar da antiga. */
export async function answerRequest(
  requestId: number,
  action: AnswerAction,
): Promise<ReceivedRequest> {
  return toReceivedRequest(
    await httpClient.post<ApiReceivedRequest>(
      `/orientacao/solicitacoes/${requestId}/responder`,
      { action },
    ),
  );
}
