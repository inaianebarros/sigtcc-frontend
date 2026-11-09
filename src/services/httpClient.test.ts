import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiError';
import { httpClient, setSessionExpiredHandler } from './httpClient';
import { mockUploads } from '../test/mockUpload';
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

describe('httpClient: envio com progresso e download', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const file = (name: string, content = 'conteúdo') =>
    new File([content], name, { type: 'application/pdf' });
  const formWith = (...files: File[]) => {
    const form = new FormData();
    for (const item of files) form.append('files', item);
    return form;
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.clear();
    setSessionExpiredHandler(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('envia o formulário com o token e os cookies, sem fixar o Content-Type', async () => {
    tokenStore.set('abc');
    const { requests } = mockUploads({
      'POST /api/atividades/7/entregas': { status: 201, body: { id: 1 } },
    });

    const result = await httpClient.upload<{ id: number }>(
      '/atividades/7/entregas',
      formWith(file('a.pdf'), file('b.pdf')),
      () => {},
    );

    expect(result).toEqual({ id: 1 });
    const [request] = requests;
    expect(request?.method).toBe('POST');
    expect(request?.headers.get('Authorization')).toBe('Bearer abc');
    // O navegador acrescenta o Content-Type com o limite do multipart: fixá-lo o quebraria.
    expect(request?.headers.has('Content-Type')).toBe(false);
    expect(request?.withCredentials).toBe(true);
    expect(request?.files.map((item) => item.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('informa o progresso em porcentagem inteira e ignora o que não tem total', async () => {
    mockUploads({
      'POST /api/atividades/7/entregas': async (_request, context) => {
        context.progress(10, 300);
        context.progress(5, 100, false);
        context.progress(150, 300);
        context.progress(300, 300);
        return { status: 201, body: {} };
      },
    });
    const progress: number[] = [];

    await httpClient.upload(
      '/atividades/7/entregas',
      formWith(file('a.pdf')),
      (percent) => progress.push(percent),
    );

    expect(progress).toEqual([0, 3, 50, 100]);
  });

  it('renova o token ao receber 401 e repete o envio, recomeçando o progresso', async () => {
    tokenStore.set('velho');
    let attempts = 0;
    const { requests } = mockUploads({
      'POST /api/atividades/7/entregas': async (_request, context) => {
        attempts += 1;
        context.progress(50, 100);
        return attempts === 1
          ? { status: 401, body: {} }
          : { status: 201, body: {} };
      },
    });
    fetchMock.mockResolvedValueOnce(json({ access_token: 'novo' }));
    const progress: number[] = [];

    await httpClient.upload(
      '/atividades/7/entregas',
      formWith(file('a.pdf')),
      (percent) => progress.push(percent),
    );

    expect(requests).toHaveLength(2);
    expect(requests[1]?.headers.get('Authorization')).toBe('Bearer novo');
    expect(requests[1]?.files.map((item) => item.name)).toEqual(['a.pdf']);
    expect(progress).toEqual([0, 50, 0, 50]);
  });

  it('com a renovação recusada, encerra a sessão e falha com 401', async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    mockUploads({
      'POST /api/atividades/7/entregas': { status: 401, body: {} },
    });
    fetchMock.mockResolvedValueOnce(json({}, 401));

    await expect(
      httpClient.upload(
        '/atividades/7/entregas',
        formWith(file('a.pdf')),
        () => {},
      ),
    ).rejects.toMatchObject({ status: 401 });

    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('leva o erro de cada arquivo do servidor para o ApiError', async () => {
    mockUploads({
      'POST /api/atividades/7/entregas': {
        status: 422,
        body: {
          detail: [
            {
              loc: ['body', 'payload', 'files.0'],
              msg: 'O arquivo está vazio.',
            },
            {
              loc: ['body', 'payload', 'files.2'],
              msg: 'Conteúdo diferente da extensão.',
            },
          ],
        },
      },
    });

    const failure = await httpClient
      .upload('/atividades/7/entregas', formWith(file('a.pdf')), () => {})
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 422,
      fieldErrors: {
        'files.0': 'O arquivo está vazio.',
        'files.2': 'Conteúdo diferente da extensão.',
      },
    });
  });

  it('mostra a mensagem do servidor num 409', async () => {
    mockUploads({
      'POST /api/atividades/7/entregas': {
        status: 409,
        body: {
          detail: 'Esta atividade está em revisão e não aceita novas entregas.',
        },
      },
    });

    await expect(
      httpClient.upload(
        '/atividades/7/entregas',
        formWith(file('a.pdf')),
        () => {},
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Esta atividade está em revisão e não aceita novas entregas.',
    });
  });

  it('transforma a falha de rede em ApiError de status 0', async () => {
    class BrokenXhr {
      upload = { onprogress: null };
      onerror: (() => void) | null = null;
      open() {}
      setRequestHeader() {}
      send() {
        this.onerror?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', BrokenXhr);

    await expect(
      httpClient.upload(
        '/atividades/7/entregas',
        formWith(file('a.pdf')),
        () => {},
      ),
    ).rejects.toMatchObject({ status: 0 });
  });

  it('baixa o arquivo como Blob com o token, e repete depois de renovar o 401', async () => {
    tokenStore.set('velho');
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ access_token: 'novo' }))
      .mockResolvedValueOnce(new Response('%PDF-conteúdo', { status: 200 }));

    const blob = await httpClient.download('/atividades/7/arquivos/3');

    expect(await blob.text()).toBe('%PDF-conteúdo');
    const [url, init] = fetchMock.mock.calls[2] ?? [];
    expect(String(url)).toContain('/atividades/7/arquivos/3');
    expect((init?.headers as Headers).get('Authorization')).toBe('Bearer novo');
  });

  it('falha com o status e a mensagem do servidor quando o arquivo não existe', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ detail: 'Arquivo não encontrado.' }, 404),
    );

    await expect(
      httpClient.download('/atividades/7/arquivos/3'),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Arquivo não encontrado.',
    });
  });
});
