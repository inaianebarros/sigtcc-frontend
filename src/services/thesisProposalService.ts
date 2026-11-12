import { httpClient } from './httpClient';

/** As propostas vêm de 5 em 5; a interface escolhe lista ou tabela pelo total (ADR 0013). */
export const THESIS_PROPOSALS_PAGE_SIZE = 5;

export const PROPOSAL_TITLE_MIN = 5;
export const PROPOSAL_TITLE_MAX = 150;

export interface ThesisProposal {
  id: number;
  title: string;
  /** O instante com o fuso, como o servidor o devolve. */
  createdAt: string;
}

export interface ThesisProposalPage {
  items: ThesisProposal[];
  count: number;
}

interface ApiThesisProposal {
  id: number;
  title: string;
  created_at: string;
}

function proposalFrom(item: ApiThesisProposal): ThesisProposal {
  return { id: item.id, title: item.title, createdAt: item.created_at };
}

function pageFrom(response: {
  items: ApiThesisProposal[];
  count: number;
}): ThesisProposalPage {
  return { count: response.count, items: response.items.map(proposalFrom) };
}

function pageParams(page: number): URLSearchParams {
  return new URLSearchParams({
    limit: String(THESIS_PROPOSALS_PAGE_SIZE),
    offset: String((page - 1) * THESIS_PROPOSALS_PAGE_SIZE),
  });
}

/** As propostas do próprio professor, da mais recente para a mais antiga (RF55, RF56). */
export async function listOwnProposals(
  page: number,
): Promise<ThesisProposalPage> {
  return pageFrom(
    await httpClient.get<{ items: ApiThesisProposal[]; count: number }>(
      `/professores/me/propostas?${pageParams(page)}`,
    ),
  );
}

/** Cada ação é salva na hora, fora do `PATCH` do perfil (ADR 0013). */
export async function createProposal(title: string): Promise<ThesisProposal> {
  return proposalFrom(
    await httpClient.post<ApiThesisProposal>('/professores/me/propostas', {
      title,
    }),
  );
}

export async function updateProposal(
  id: number,
  title: string,
): Promise<ThesisProposal> {
  return proposalFrom(
    await httpClient.patch<ApiThesisProposal>(
      `/professores/me/propostas/${id}`,
      { title },
    ),
  );
}

/** A remoção é definitiva (RF55). */
export async function deleteProposal(id: number): Promise<void> {
  await httpClient.delete(`/professores/me/propostas/${id}`);
}

/**
 * As propostas de tema de um professor do curso do aluno, só para leitura (RF56, RN42). O servidor
 * responde 404 para um professor de outro curso, um inativo e um id que não existe.
 */
export async function listAdvisorProposals(
  teacherId: number,
  page: number,
): Promise<ThesisProposalPage> {
  return pageFrom(
    await httpClient.get<{ items: ApiThesisProposal[]; count: number }>(
      `/professores/${teacherId}/propostas?${pageParams(page)}`,
    ),
  );
}
