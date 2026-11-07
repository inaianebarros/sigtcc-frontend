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

  it('envia PATCH com o corpo em JSON', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true }));

    await httpClient.patch('/alunos/me/perfil', { full_name: 'Ana' });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/alunos/me/perfil');
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe(JSON.stringify({ full_name: 'Ana' }));
    expect((init?.headers as Headers).get('Content-Type')).toBe(
      'application/json',
    );
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

describe('limite de tentativas (429)', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const rateLimited = (headers?: Record<string, string>) =>
    new Response(
      JSON.stringify({
        detail: 'Muitas tentativas. Aguarde antes de tentar novamente.',
      }),
      { status: 429, headers },
    );

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.clear();
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('usa o Retry-After para dizer quanto tempo esperar', async () => {
    fetchMock.mockResolvedValueOnce(rateLimited({ 'Retry-After': '900' }));

    const error: unknown = await httpClient
      .post('/auth/login', { email: 'a@b.c', password: 'x' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      retryAfterSeconds: 900,
      message: 'Muitas tentativas. Tente novamente em 15 minutos.',
    });
  });

  it('sem Retry-After usa a mensagem do servidor', async () => {
    fetchMock.mockResolvedValueOnce(rateLimited());

    const error: unknown = await httpClient
      .post('/auth/login', {})
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      status: 429,
      message: 'Muitas tentativas. Aguarde antes de tentar novamente.',
    });
    expect((error as ApiError).retryAfterSeconds).toBeUndefined();
  });

  it('ignora um Retry-After que não é um número positivo', async () => {
    fetchMock.mockResolvedValueOnce(rateLimited({ 'Retry-After': 'amanhã' }));

    const error: unknown = await httpClient
      .post('/auth/login', {})
      .catch((caught: unknown) => caught);

    expect((error as ApiError).retryAfterSeconds).toBeUndefined();
  });

  it('entende o Retry-After escrito como data HTTP', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    fetchMock.mockResolvedValueOnce(
      rateLimited({ 'Retry-After': 'Thu, 01 Jan 2026 00:01:30 GMT' }),
    );

    const error: unknown = await httpClient
      .post('/auth/login', {})
      .catch((caught: unknown) => caught);

    vi.useRealTimers();
    expect(error).toMatchObject({
      retryAfterSeconds: 90,
      message: 'Muitas tentativas. Tente novamente em 2 minutos.',
    });
  });

  it('um 429 na renovação da sessão avisa a espera e não derruba a sessão', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    tokenStore.set('token-que-expirou');
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(rateLimited({ 'Retry-After': '30' }));

    const error: unknown = await httpClient
      .get('/auth/me')
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      status: 429,
      retryAfterSeconds: 30,
      message: 'Muitas tentativas. Tente novamente em 30 segundos.',
    });
    expect(tokenStore.get()).toBe('token-que-expirou');
    expect(onExpired).not.toHaveBeenCalled();
  });
});
