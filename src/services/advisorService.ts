import { httpClient } from './httpClient';

export const ADVISORS_PAGE_SIZE = 20;

export interface NamedItem {
  id: number;
  name: string;
}

export interface AdvisorArea extends NamedItem {
  isCommon: boolean;
}

export interface ThesisProposalSummary {
  id: number;
  title: string;
}

export interface Advisor {
  id: number;
  fullName: string;
  institute: NamedItem;
  compatibility: number;
  commonAreas: NamedItem[];
  /** Todas as áreas do professor, as em comum primeiro. */
  areas: AdvisorArea[];
  /** Os temas propostos mais recentes (até 3) e o total do professor. */
  thesisProposals: { items: ThesisProposalSummary[]; total: number };
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
  areas: (NamedItem & { is_common: boolean })[];
  thesis_proposals: { items: ThesisProposalSummary[]; total: number };
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
      areas: advisor.areas.map(({ id, name, is_common: isCommon }) => ({
        id,
        name,
        isCommon,
      })),
      thesisProposals: advisor.thesis_proposals,
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

/** O tamanho da página da lista de solicitações do aluno (RF16). */
export const MY_REQUESTS_PAGE_SIZE = 10;

export interface MyRequestItem {
  id: number;
  status: AdvisingRequestStatus;
  requestedAt: string;
  respondedAt: string | null;
  /** O prazo de resposta; vem nas pendentes e nas não respondidas. */
  expiresAt: string | null;
  teacher: {
    id: number;
    fullName: string;
    institute: { id: number; name: string } | null;
  };
  /** A orientação que a solicitação criou, quando foi aceita. */
  advising: {
    id: number;
    status: 'active' | 'ended';
    startedAt: string;
    endedAt: string | null;
  } | null;
}

export interface MyRequestsPage {
  items: MyRequestItem[];
  count: number;
}

interface ApiMyRequestsPage {
  items: {
    id: number;
    status: AdvisingRequestStatus;
    requested_at: string;
    responded_at: string | null;
    expires_at: string | null;
    teacher: {
      id: number;
      full_name: string;
      institute: { id: number; name: string } | null;
    };
    advising: {
      id: number;
      status: 'active' | 'ended';
      started_at: string;
      ended_at: string | null;
    } | null;
  }[];
  count: number;
}

/**
 * Todas as solicitações do aluno, da mais recente para a mais antiga, paginadas no servidor (RF16).
 * `name` filtra pelo nome do professor, sem diferenciar maiúsculas nem acentos.
 */
export async function listMyRequests(
  page: number,
  name?: string,
): Promise<MyRequestsPage> {
  const params = new URLSearchParams({
    limit: String(MY_REQUESTS_PAGE_SIZE),
    offset: String((page - 1) * MY_REQUESTS_PAGE_SIZE),
  });
  if (name) params.set('name', name);
  const response = await httpClient.get<ApiMyRequestsPage>(
    `/orientacao/minhas-solicitacoes?${params}`,
  );
  return {
    count: response.count,
    items: response.items.map((item) => ({
      id: item.id,
      status: item.status,
      requestedAt: item.requested_at,
      respondedAt: item.responded_at,
      expiresAt: item.expires_at,
      teacher: {
        id: item.teacher.id,
        fullName: item.teacher.full_name,
        institute: item.teacher.institute,
      },
      advising: item.advising && {
        id: item.advising.id,
        status: item.advising.status,
        startedAt: item.advising.started_at,
        endedAt: item.advising.ended_at,
      },
    })),
  };
}
