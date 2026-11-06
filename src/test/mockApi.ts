import { vi } from 'vitest';

export interface MockResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

type Handler = (
  body: unknown,
  url: URL,
) => MockResponse | Promise<MockResponse>;

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
    const route = routes[`${method} ${url.pathname}`];
    if (!route) return jsonResponse({ status: 404, body: {} });

    const body: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const result = typeof route === 'function' ? await route(body, url) : route;
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
