import type { MockResponse } from './mockApi';

export interface FakeProposal {
  id: number;
  title: string;
  created_at: string;
}

type Handler = (
  body: unknown,
  url: URL,
  params: Record<string, string>,
) => MockResponse | Promise<MockResponse>;

/** Uma proposta cujo `created_at` cresce com o id: a de maior id é a mais recente. */
export function makeProposal(id: number, title?: string): FakeProposal {
  return {
    id,
    title: title ?? `Proposta de tema número ${String(id).padStart(2, '0')}`,
    created_at: new Date(Date.UTC(2026, 10, 1, 12, 0, id)).toISOString(),
  };
}

function key(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function titleError(message: string): MockResponse {
  return {
    status: 422,
    body: {
      detail: [
        {
          loc: ['body', 'payload', 'title'],
          msg: message,
          type: 'value_error',
        },
      ],
    },
  };
}

export interface ProposalsServer {
  routes: Record<string, MockResponse | Handler>;
  proposals: () => FakeProposal[];
}

/**
 * Um servidor de propostas de tema simulado com estado, como a API real: lista da mais recente para
 * a mais antiga em páginas, valida o título (5 a 150 caracteres, sem repetição), limita a 50 por
 * professor e remove de vez.
 */
export function proposalsServer(initial: FakeProposal[]): ProposalsServer {
  const state = initial.map((item) => structuredClone(item));
  let nextId = Math.max(0, ...initial.map((item) => item.id)) + 1;
  const validate = (title: string, ignoreId?: number): MockResponse | null => {
    const trimmed = title.trim();
    if (trimmed.length < 5 || trimmed.length > 150)
      return titleError('O título deve ter de 5 a 150 caracteres.');
    const taken = state.some(
      (item) => item.id !== ignoreId && key(item.title) === key(trimmed),
    );
    return taken
      ? titleError('Você já tem uma proposta com esse título.')
      : null;
  };
  return {
    proposals: () => state,
    routes: {
      'GET /api/professores/me/propostas': (_body, url) => {
        const limit = Number(url.searchParams.get('limit') ?? 5);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const newestFirst = [...state].sort(
          (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
        );
        return {
          body: {
            items: newestFirst.slice(offset, offset + limit),
            count: newestFirst.length,
          },
        };
      },
      'POST /api/professores/me/propostas': (body) => {
        const { title } = body as { title: string };
        if (state.length >= 50)
          return {
            status: 409,
            body: {
              detail:
                'Você já tem 50 propostas de tema. Remova uma para cadastrar outra.',
            },
          };
        const invalid = validate(title);
        if (invalid) return invalid;
        const created = makeProposal(nextId++, title.trim());
        state.push(created);
        return { status: 201, body: created };
      },
      'PATCH /api/professores/me/propostas/:id': (body, _url, params) => {
        const found = state.find((item) => item.id === Number(params.id));
        if (!found)
          return {
            status: 404,
            body: { detail: 'Proposta de tema não encontrada.' },
          };
        const { title } = body as { title: string };
        const invalid = validate(title, found.id);
        if (invalid) return invalid;
        found.title = title.trim();
        return { body: found };
      },
      'DELETE /api/professores/me/propostas/:id': (_body, _url, params) => {
        const index = state.findIndex((item) => item.id === Number(params.id));
        if (index === -1)
          return {
            status: 404,
            body: { detail: 'Proposta de tema não encontrada.' },
          };
        state.splice(index, 1);
        return { status: 204 };
      },
    },
  };
}
