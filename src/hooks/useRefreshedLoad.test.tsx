import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../contexts/sessionContext';
import type { SessionStatus } from '../contexts/sessionContext';
import { ApiError } from '../services/apiError';
import { REFRESH_INTERVAL_MS, useRefreshedLoad } from './useRefreshedLoad';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function sessionWrapper(status: SessionStatus) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SessionContext.Provider
        value={{
          status,
          user: null,
          expiredMessage: null,
          signIn: async () => undefined,
          signOut: async () => undefined,
          refreshUser: async () => undefined,
        }}
      >
        {children}
      </SessionContext.Provider>
    );
  };
}

/** Uma leitura que só termina quando o teste manda. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {});
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('useRefreshedLoad', () => {
  it('com a key nula fica parado, sem ler nem reler', async () => {
    const load = vi.fn(async () => 1);
    const { result, rerender } = renderHook(
      ({ key }: { key: string | null }) => useRefreshedLoad(load, key),
      {
        wrapper: sessionWrapper('authenticated'),
        initialProps: { key: null as string | null },
      },
    );
    await advance(REFRESH_INTERVAL_MS * 2);
    expect(result.current.state).toEqual({ status: 'idle' });
    expect(load).not.toHaveBeenCalled();

    rerender({ key: 'a' });
    await flush();
    expect(result.current.state).toEqual({ status: 'ready', data: 1 });

    rerender({ key: null });
    expect(result.current.state).toEqual({ status: 'idle' });
    await advance(REFRESH_INTERVAL_MS * 2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('relê a cada 30 s com a aba visível, sem voltar a carregar', async () => {
    let value = 0;
    const load = vi.fn(async () => ++value);
    const { result } = renderHook(() => useRefreshedLoad(load), {
      wrapper: sessionWrapper('authenticated'),
    });
    expect(result.current.state).toEqual({ status: 'loading' });
    await flush();
    expect(result.current.state).toEqual({ status: 'ready', data: 1 });

    await advance(REFRESH_INTERVAL_MS - 1);
    expect(load).toHaveBeenCalledTimes(1);

    await advance(1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({ status: 'ready', data: 2 });

    await advance(REFRESH_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(3);
    expect(result.current.state).toEqual({ status: 'ready', data: 3 });
  });

  it('não relê com a aba oculta e relê na hora ao voltar para ela', async () => {
    const load = vi.fn(async () => 'dados');
    renderHook(() => useRefreshedLoad(load), {
      wrapper: sessionWrapper('authenticated'),
    });
    await flush();
    expect(load).toHaveBeenCalledTimes(1);

    act(() => setVisibility('hidden'));
    await advance(REFRESH_INTERVAL_MS * 4);
    expect(load).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    await flush();
    expect(load).toHaveBeenCalledTimes(2);

    await advance(REFRESH_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('enquanto relê e quando a releitura falha, mantém os dados sem carregamento nem erro', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const third = deferred<string>();
    const load = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise);
    const { result } = renderHook(() => useRefreshedLoad(load), {
      wrapper: sessionWrapper('authenticated'),
    });
    first.resolve('antes');
    await flush();

    await advance(REFRESH_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({ status: 'ready', data: 'antes' });

    second.reject(new ApiError(500, 'Falhou'));
    await flush();
    expect(result.current.state).toEqual({ status: 'ready', data: 'antes' });

    // Depois da falha o ciclo continua e a próxima releitura traz o dado novo.
    await advance(REFRESH_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(3);
    third.resolve('depois');
    await flush();
    expect(result.current.state).toEqual({ status: 'ready', data: 'depois' });
  });

  it('não começa uma releitura enquanto a anterior não terminou', async () => {
    const slow = deferred<string>();
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('primeira')
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValue('seguinte');
    renderHook(() => useRefreshedLoad(load), {
      wrapper: sessionWrapper('authenticated'),
    });
    await flush();

    await advance(REFRESH_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(2);

    await advance(REFRESH_INTERVAL_MS * 3);
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await flush();
    expect(load).toHaveBeenCalledTimes(2);

    slow.resolve('lenta');
    await flush();
    await advance(REFRESH_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('a primeira leitura com erro mostra o erro e não é refeita sozinha', async () => {
    const load = vi.fn(async () => {
      throw new ApiError(500, 'Não foi possível carregar.');
    });
    const { result } = renderHook(() => useRefreshedLoad(load), {
      wrapper: sessionWrapper('authenticated'),
    });
    await flush();
    expect(result.current.state).toEqual({
      status: 'error',
      message: 'Não foi possível carregar.',
    });

    await advance(REFRESH_INTERVAL_MS * 3);
    expect(load).toHaveBeenCalledTimes(1);

    act(() => result.current.retry());
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('a troca de key (página, filtro) é uma leitura nova, com carregamento', async () => {
    const load = vi.fn(async () => 'dados');
    const { result, rerender } = renderHook(
      ({ page }) => useRefreshedLoad(load, page),
      {
        wrapper: sessionWrapper('authenticated'),
        initialProps: { page: 1 },
      },
    );
    await flush();

    rerender({ page: 2 });
    expect(result.current.state).toEqual({ status: 'loading' });
    await flush();
    expect(result.current.state).toEqual({ status: 'ready', data: 'dados' });
  });

  it('para ao desmontar', async () => {
    const load = vi.fn(async () => 'dados');
    const { unmount } = renderHook(() => useRefreshedLoad(load), {
      wrapper: sessionWrapper('authenticated'),
    });
    await flush();

    unmount();
    await advance(REFRESH_INTERVAL_MS * 3);
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('sem sessão não relê', async () => {
    const load = vi.fn(async () => 'dados');
    renderHook(() => useRefreshedLoad(load), {
      wrapper: sessionWrapper('anonymous'),
    });
    await flush();

    await advance(REFRESH_INTERVAL_MS * 3);
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await flush();

    expect(load).toHaveBeenCalledTimes(1);
  });
});

interface Item {
  id: number;
  title: string;
}

function ItemList({ load }: { load: () => Promise<Item[]> }) {
  const { state } = useRefreshedLoad(load);
  if (state.status !== 'ready') return <p>Carregando</p>;
  return (
    <>
      <p role="status">{`${state.data.length} itens`}</p>
      <ul>
        {state.data.map((item) => (
          <li key={item.id}>
            <details>
              <summary>{item.title}</summary>
              Detalhes
            </details>
          </li>
        ))}
      </ul>
      <label>
        Rascunho
        <input />
      </label>
    </>
  );
}

describe('useRefreshedLoad numa tela', () => {
  it('troca só o que mudou, sem tirar o foco, o rascunho nem os itens abertos', async () => {
    let titles = ['Primeira', 'Segunda'];
    const load = vi.fn(async () =>
      titles.map((title, index) => ({ id: index + 1, title })),
    );
    const Wrapper = sessionWrapper('authenticated');
    render(
      <Wrapper>
        <ItemList load={load} />
      </Wrapper>,
    );
    await flush();
    const first = screen.getByText('Primeira').closest('details');
    if (first === null) throw new Error('details ausente');
    first.open = true;
    const draft = screen.getByLabelText('Rascunho');
    act(() => draft.focus());
    fireEvent.change(draft, { target: { value: 'texto em andamento' } });
    const announcer = screen.getByRole('status');
    const announced = vi.fn();
    const observer = new MutationObserver(announced);
    observer.observe(announcer, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    titles = ['Primeira', 'Segunda renomeada'];
    await advance(REFRESH_INTERVAL_MS);

    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Segunda renomeada')).toBeInTheDocument();
    expect(screen.getByText('Primeira').closest('details')).toBe(first);
    expect(first.open).toBe(true);
    expect(draft).toHaveFocus();
    expect(draft).toHaveValue('texto em andamento');
    await flush();
    expect(announced).not.toHaveBeenCalled();
    observer.disconnect();
  });
});
