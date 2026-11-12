import {
  PROPOSAL_TITLE_MAX,
  PROPOSAL_TITLE_MIN,
} from '../services/thesisProposalService';

export const TITLE_TOO_SHORT_MESSAGE = `O título deve ter pelo menos ${PROPOSAL_TITLE_MIN} caracteres.`;
export const TITLE_TOO_LONG_MESSAGE = `O título deve ter no máximo ${PROPOSAL_TITLE_MAX} caracteres.`;

/** A mensagem de validação do título (5 a 150 caracteres, sem contar as pontas), ou `null`. */
export function titleProblem(title: string): string | null {
  const length = title.trim().length;
  if (length < PROPOSAL_TITLE_MIN) return TITLE_TOO_SHORT_MESSAGE;
  if (length > PROPOSAL_TITLE_MAX) return TITLE_TOO_LONG_MESSAGE;
  return null;
}
