import { httpClient } from './httpClient';

export const ADVISORS_PAGE_SIZE = 20;

export interface NamedItem {
  id: number;
  name: string;
}

export interface Advisor {
  id: number;
  fullName: string;
  institute: NamedItem;
  compatibility: number;
  commonAreas: NamedItem[];
  isAvailable: boolean;
}

export interface AdvisorPage {
  items: Advisor[];
  count: number;
}

interface ApiAdvisor {
  id: number;
  full_name: string;
  institute: NamedItem;
  compatibility: number;
  common_areas: NamedItem[];
  is_available: boolean;
}

export async function searchAdvisors({
  name,
  page,
  showAll,
}: {
  name: string;
  page: number;
  /** Falso é o padrão do servidor (só com área em comum) e não vai na requisição. */
  showAll: boolean;
}): Promise<AdvisorPage> {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (showAll) params.set('show_all', 'true');
  params.set('limit', String(ADVISORS_PAGE_SIZE));
  params.set('offset', String((page - 1) * ADVISORS_PAGE_SIZE));
  const response = await httpClient.get<{ items: ApiAdvisor[]; count: number }>(
    `/orientadores/busca?${params}`,
  );
  return {
    count: response.count,
    items: response.items.map((advisor) => ({
      id: advisor.id,
      fullName: advisor.full_name,
      institute: advisor.institute,
      compatibility: advisor.compatibility,
      commonAreas: advisor.common_areas,
      isAvailable: advisor.is_available,
    })),
  };
}

export type BlockedReason = 'active_advising' | 'pending_request';

export interface RequestEligibility {
  canRequest: boolean;
  blockedReason: BlockedReason | null;
}

export type AdvisingRequestStatus =
  'pending' | 'accepted' | 'rejected' | 'unanswered';

export interface MyRequest {
  id: number;
  status: AdvisingRequestStatus;
  requestedAt: string;
  respondedAt: string | null;
  /** O prazo para o professor responder; só existe enquanto a solicitação não foi respondida. */
  expiresAt: string | null;
  teacher: { id: number; fullName: string };
}

export interface MyAdvising {
  id: number;
  startedAt: string;
  teacher: { id: number; fullName: string };
}

export interface RequestStatus extends RequestEligibility {
  request: MyRequest | null;
  advising: MyAdvising | null;
}

interface ApiTeacher {
  id: number;
  full_name: string;
}

/** O frontend só lê o que o servidor decidiu (RN04, RN05 e RN20); não repete as regras. */
interface ApiRequestStatus {
  request: {
    id: number;
    status: AdvisingRequestStatus;
    requested_at: string;
    responded_at: string | null;
    expires_at: string | null;
    teacher: ApiTeacher;
  } | null;
  advising: { id: number; started_at: string; teacher: ApiTeacher } | null;
  can_request: boolean;
  blocked_reason: BlockedReason | null;
}

function fetchRequestStatus(): Promise<ApiRequestStatus> {
  return httpClient.get<ApiRequestStatus>('/orientacao/minha-solicitacao');
}

export async function getRequestStatus(): Promise<RequestStatus> {
  const response = await fetchRequestStatus();
  const { request, advising } = response;
  return {
    canRequest: response.can_request,
    blockedReason: response.blocked_reason,
    request: request && {
      id: request.id,
      status: request.status,
      requestedAt: request.requested_at,
      respondedAt: request.responded_at,
      expiresAt: request.expires_at,
      teacher: { id: request.teacher.id, fullName: request.teacher.full_name },
    },
    advising: advising && {
      id: advising.id,
      startedAt: advising.started_at,
      teacher: {
        id: advising.teacher.id,
        fullName: advising.teacher.full_name,
      },
    },
  };
}

/** A busca de orientadores só precisa destes dois campos: o resto do status não pode derrubá-la. */
export async function getRequestEligibility(): Promise<RequestEligibility> {
  const response = await fetchRequestStatus();
  return {
    canRequest: response.can_request,
    blockedReason: response.blocked_reason,
  };
}

export async function requestAdvising(teacherId: number): Promise<void> {
  await httpClient.post('/orientacao/solicitacoes', { teacher_id: teacherId });
}
