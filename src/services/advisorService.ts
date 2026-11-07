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
}: {
  name: string;
  page: number;
}): Promise<AdvisorPage> {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
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

/** O frontend só lê o que o servidor decidiu (RN04 e RN05); não repete as regras. */
export async function getRequestEligibility(): Promise<RequestEligibility> {
  const response = await httpClient.get<{
    can_request: boolean;
    blocked_reason: BlockedReason | null;
  }>('/orientacao/minha-solicitacao');
  return {
    canRequest: response.can_request,
    blockedReason: response.blocked_reason,
  };
}

export async function requestAdvising(teacherId: number): Promise<void> {
  await httpClient.post('/orientacao/solicitacoes', { teacher_id: teacherId });
}
