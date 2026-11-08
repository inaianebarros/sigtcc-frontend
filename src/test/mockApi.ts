import { vi } from 'vitest';

export interface MockResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

type Handler = (
  body: unknown,
  url: URL,
  params: Record<string, string>,
) => MockResponse | Promise<MockResponse>;

/** Casa `GET /api/atividades/:id` com `GET /api/atividades/7`, devolvendo `{ id: '7' }`. */
function findRoute<T>(
  routes: Record<string, T>,
  method: string,
  pathname: string,
): { route: T; params: Record<string, string> } | null {
  const exact = routes[`${method} ${pathname}`];
  if (exact) return { route: exact, params: {} };
  const parts = pathname.split('/');
  for (const [key, route] of Object.entries(routes)) {
    const [keyMethod, keyPath] = key.split(' ') as [string, string];
    if (keyMethod !== method || !keyPath.includes(':')) continue;
    const keyParts = keyPath.split('/');
    if (keyParts.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const matches = keyParts.every((part, index) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = parts[index]!;
        return true;
      }
      return part === parts[index];
    });
    if (matches) return { route, params };
  }
  return null;
}

export function jsonResponse({
  status = 200,
  body,
  headers,
}: MockResponse): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

export function mockApi(routes: Record<string, MockResponse | Handler>) {
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const method = init?.method ?? 'GET';
    const url = new URL(String(input), 'http://localhost');
    const found = findRoute(routes, method, url.pathname);
    if (!found) return jsonResponse({ status: 404, body: {} });
    const { route, params } = found;

    const body: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const result =
      typeof route === 'function' ? await route(body, url, params) : route;
    return jsonResponse(result);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function requestsTo(
  fetchMock: ReturnType<typeof mockApi>,
  route: string,
) {
  return fetchMock.mock.calls.filter(
    ([input, init]) =>
      `${init?.method ?? 'GET'} ${new URL(String(input), 'http://localhost').pathname}` ===
      route,
  );
}
