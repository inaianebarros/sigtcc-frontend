export const MAX_FILES = 5;
export const MAX_FILE_MEGABYTES = 10;
export const MAX_FILE_BYTES = MAX_FILE_MEGABYTES * 1024 * 1024;

export const COUNT_MESSAGE = `Envie no máximo ${MAX_FILES} arquivos por entrega.`;
const EMPTY_MESSAGE = 'O arquivo está vazio.';
const TOO_BIG_MESSAGE = `O arquivo excede o limite de ${MAX_FILE_MEGABYTES} MB.`;
const NOT_ALLOWED_MESSAGE =
  'Tipo de arquivo não permitido. Envie PDF, DOC, DOCX, ZIP, PNG ou JPG.';

const DOCX_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Os tipos aceitos pelo servidor (RF31), pela extensão: o conteúdo só o servidor confere. */
const TYPES_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': DOCX_TYPE,
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export const ACCEPTED_EXTENSIONS = Object.keys(TYPES_BY_EXTENSION).join(',');

/** O tipo que o servidor guardará para o arquivo, ou `null` se a extensão não é aceita. */
export function contentTypeOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return null;
  return TYPES_BY_EXTENSION[fileName.slice(dot).toLowerCase()] ?? null;
}

/** O primeiro problema de um arquivo, ou `null`: tipo, vazio e tamanho, como o servidor. */
export function problemWith(file: File): string | null {
  if (contentTypeOf(file.name) === null) return NOT_ALLOWED_MESSAGE;
  if (file.size === 0) return EMPTY_MESSAGE;
  if (file.size > MAX_FILE_BYTES) return TOO_BIG_MESSAGE;
  return null;
}
