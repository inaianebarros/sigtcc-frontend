import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiError';
import { httpClient, setSessionExpiredHandler } from './httpClient';
import { tokenStore } from './tokenStore';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('httpClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.clear();
    setSessionExpiredHandler(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('anexa o access token em memória', async () => {
    tokenStore.set('abc');
    fetchMock.mockResolvedValueOnce(json({ ok: true }));

    await httpClient.get('/ping');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer abc');
  });

  it('renova o token uma vez ao receber 401 e repete a requisição', async () => {
    tokenStore.set('velho');
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ access_token: 'novo' }))
      .mockResolvedValueOnce(json({ ok: true }));

    await expect(httpClient.get('/ping')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer novo');
  });

  it('compartilha uma única renovação entre requisições simultâneas', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return json({ access_token: 'novo' });
      }
      const auth = new Headers(init?.headers).get('Authorization');
      return auth === 'Bearer novo' ? json({ ok: true }) : json({}, 401);
    });

    await Promise.all([httpClient.get('/a'), httpClient.get('/b')]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it('limpa a sessão e avisa quando a renovação falha', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    tokenStore.set('velho');
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({}, 401));

    await expect(httpClient.get('/ping')).rejects.toMatchObject({
      status: 401,
    });

    expect(tokenStore.get()).toBeNull();
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it('traduz falha de rede em ApiError com mensagem em português', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network'));

    const error = await httpClient.get('/ping').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toMatch(/conectar ao servidor/);
  });
});
