import { useCallback, useEffect, useEffectEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { positiveIntFrom } from '../navigation/positiveInt';

/** O nome do parâmetro da página na URL; quem troca o filtro de uma lista o apaga. */
export const PAGE_PARAM = 'pagina';

/** Só um inteiro de 1 em diante vale; qualquer outra coisa na URL é a primeira página. */
export function pageFrom(value: string | null): number {
  return positiveIntFrom(value) ?? 1;
}

export type SetUrlPage = (
  next: number,
  options?: { replace?: boolean },
) => void;

/**
 * A página de uma lista, guardada na URL (`?pagina=3`): recarregar ou voltar de outra tela a
 * restaura. A primeira página fica sem o parâmetro, e os outros parâmetros da URL, como o filtro,
 * são mantidos.
 */
export function useUrlPage(): readonly [number, SetUrlPage] {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = pageFrom(searchParams.get(PAGE_PARAM));
  const setPage = useCallback<SetUrlPage>(
    (next, { replace = false } = {}) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === 1) params.delete(PAGE_PARAM);
          else params.set(PAGE_PARAM, String(next));
          return params;
        },
        { replace },
      );
    },
    [setSearchParams],
  );
  return [page, setPage];
}

/**
 * Uma página além da última (um link antigo, ou a lista que encolheu) volta para a última que
 * existe, sem entrar no histórico. É um efeito, e não a correção na renderização das listas com a
 * página em estado local: a página vive na URL, e navegar durante a renderização atualizaria o
 * roteador no meio dela.
 */
export function useReturnToLastPage(
  fallbackPage: number | null,
  page: number,
  setPage: SetUrlPage,
) {
  const backToLastPage = useEffectEvent((last: number) =>
    setPage(last, { replace: true }),
  );
  useEffect(() => {
    if (fallbackPage !== null && fallbackPage !== page) {
      backToLastPage(fallbackPage);
    }
  }, [fallbackPage, page]);
}
