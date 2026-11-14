import { vi } from 'vitest';
import type { MockResponse } from './mockApi';

/** Lançada por um tratador para simular o envio que falha sem resposta, como a rede fora. */
export class UploadNetworkError extends Error {}

/** O que o cliente enviou num pedido com progresso, para os testes conferirem. */
export interface UploadRequest {
  method: string;
  url: URL;
  headers: Headers;
  withCredentials: boolean;
  body: FormData;
  /** Os arquivos do campo `files`, na ordem em que foram anexados. */
  files: File[];
}

export interface UploadContext {
  /** Dispara um evento de progresso do envio, como o navegador o faz. */
  progress: (loaded: number, total: number, lengthComputable?: boolean) => void;
}

type UploadHandler = (
  request: UploadRequest,
  context: UploadContext,
) => MockResponse | Promise<MockResponse>;

interface UploadProgressEvent {
  lengthComputable: boolean;
  loaded: number;
  total: number;
}

/**
 * Troca `XMLHttpRequest` por um simulador dirigido por rotas, como o `mockApi` faz com `fetch`:
 * o jsdom não tem rede, e o envio com progresso (ADR frontend 0003) não passa por `fetch`.
 */
export function mockUploads(
  routes: Record<string, MockResponse | UploadHandler>,
) {
  const requests: UploadRequest[] = [];

  class FakeXhr {
    upload: { onprogress: ((event: UploadProgressEvent) => void) | null } = {
      onprogress: null,
    };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    withCredentials = false;
    status = 0;
    responseText = '';
    private method = '';
    private url = '';
    private readonly requestHeaders = new Headers();
    private responseHeaders: Record<string, string> = {};

    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(name: string, value: string) {
      this.requestHeaders.set(name, value);
    }

    getResponseHeader(name: string): string | null {
      const key = Object.keys(this.responseHeaders).find(
        (header) => header.toLowerCase() === name.toLowerCase(),
      );
      return key === undefined ? null : (this.responseHeaders[key] ?? null);
    }

    abort() {}

    send(body: FormData) {
      const url = new URL(this.url, 'http://localhost');
      const request: UploadRequest = {
        method: this.method,
        url,
        headers: this.requestHeaders,
        withCredentials: this.withCredentials,
        body,
        files: body
          .getAll('files')
          .filter((item): item is File => item instanceof File),
      };
      requests.push(request);
      void (async () => {
        const route = routes[`${this.method} ${url.pathname}`];
        if (route === undefined) {
          this.finish({ status: 404, body: {} });
          return;
        }
        const context: UploadContext = {
          progress: (loaded, total, lengthComputable = true) =>
            this.upload.onprogress?.({ lengthComputable, loaded, total }),
        };
        try {
          const result =
            typeof route === 'function' ? await route(request, context) : route;
          this.finish(result);
        } catch (error) {
          if (!(error instanceof UploadNetworkError)) throw error;
          this.onerror?.();
        }
      })();
    }

    private finish({ status = 200, body, headers = {} }: MockResponse) {
      this.status = status;
      this.responseHeaders = headers;
      this.responseText = body === undefined ? '' : JSON.stringify(body);
      this.onload?.();
    }
  }

  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  return { requests };
}
