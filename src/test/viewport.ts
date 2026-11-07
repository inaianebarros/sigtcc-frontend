import { vi } from 'vitest';

export const DESKTOP_WIDTH = 1280;
export const PHONE_WIDTH = 390;

function matches(query: string, width: number): boolean {
  const conditions = query.match(/\((min|max)-width:\s*([\d.]+)px\)/g) ?? [];
  return conditions.every((condition) => {
    const [, kind, value] = /\((min|max)-width:\s*([\d.]+)px\)/.exec(
      condition,
    )!;
    return kind === 'min' ? width >= Number(value) : width <= Number(value);
  });
}

export function setViewportWidth(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches(query, width),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}
