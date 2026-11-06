// @vitest-environment node
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';

type ProxyOptions = { xfwd?: boolean; changeOrigin?: boolean };

describe('vite.config', () => {
  it('repassa o IP real do cliente ao backend pelo proxy de /api', async () => {
    const config =
      typeof viteConfig === 'function'
        ? await viteConfig({ command: 'serve', mode: 'test' })
        : await viteConfig;

    const proxy = config.server?.proxy as Record<string, ProxyOptions>;

    expect(proxy['/api']?.xfwd).toBe(true);
  });
});
