import { useRef, useState } from 'react';
import type { ApiError } from '../services/apiError';
import { MAX_FILES, problemWith } from './fileValidation';

const FILE_ERROR_FIELD = /^files\.(\d+)$/;

interface ChosenFile {
  /** Identifica o arquivo na lista, mesmo com dois de mesmo nome. */
  key: number;
  file: File;
}

interface UseChosenFilesOptions {
  /** Trava a escolha e a remoção, enquanto o envio está em andamento. */
  disabled: boolean;
  /** Chamada quando chegam arquivos novos, para quem usa limpar o próprio alerta. */
  onAdd?: () => void;
}

/**
 * Os arquivos escolhidos num diálogo: até {@link MAX_FILES}, cada um conferido como o servidor o
 * fará (tipo, vazio e tamanho), e os erros que o servidor devolve para cada arquivo.
 */
export function useChosenFiles({ disabled, onAdd }: UseChosenFilesOptions) {
  const nextKey = useRef(0);
  const [chosen, setChosen] = useState<ChosenFile[]>([]);
  const [overflowed, setOverflowed] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<number, string>>({});

  const problems = chosen.map(({ file }) => problemWith(file));

  const add = (incoming: File[]) => {
    if (disabled || incoming.length === 0) return;
    const room = Math.max(MAX_FILES - chosen.length, 0);
    const accepted = incoming.slice(0, room);
    setOverflowed(accepted.length < incoming.length);
    setServerErrors({});
    onAdd?.();
    setChosen([
      ...chosen,
      ...accepted.map((file) => ({ key: nextKey.current++, file })),
    ]);
  };

  const remove = (key: number) => {
    setOverflowed(false);
    setChosen(chosen.filter((item) => item.key !== key));
  };

  /**
   * Leva ao arquivo certo cada erro `files.N` do servidor e devolve os demais erros por campo,
   * que quem usa trata como quiser.
   */
  const applyServerErrors = (error: ApiError): Record<string, string> => {
    const byFile: Record<number, string> = {};
    const rest: Record<string, string> = {};
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      const index = FILE_ERROR_FIELD.exec(field)?.[1];
      const target = index === undefined ? undefined : chosen[Number(index)];
      if (target) byFile[target.key] = message;
      else rest[field] = message;
    }
    setServerErrors(byFile);
    return rest;
  };

  return {
    chosen,
    files: chosen.map((item) => item.file),
    problems,
    hasProblem: problems.some((problem) => problem !== null),
    overflowed,
    serverErrors,
    setServerErrors,
    applyServerErrors,
    disabled,
    add,
    remove,
  };
}

export type ChosenFiles = ReturnType<typeof useChosenFiles>;
