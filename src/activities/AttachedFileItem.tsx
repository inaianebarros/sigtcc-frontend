import DownloadIcon from '@mui/icons-material/Download';
import { Button, Typography } from '@mui/material';
import { useState } from 'react';
import { formatFileSize } from '../formatters/fileSize';
import { useFeedback } from '../hooks/useFeedback';
import type { SubmissionFile } from '../services/activityService';
import { ApiError, messageOf } from '../services/apiError';
import { saveFile } from './saveFile';

export const FILE_NOT_FOUND_MESSAGE = 'O arquivo não foi encontrado.';

interface AttachedFileItemProps {
  file: SubmissionFile;
  /** Busca o conteúdo do arquivo por requisição autenticada; falha com o `ApiError` do servidor. */
  load: () => Promise<Blob>;
}

/**
 * Um arquivo guardado, com a ação de baixar para o aluno e para o orientador: o de uma Entrega
 * (RF31) ou o de um Anexo da Revisão (RN48).
 */
export function AttachedFileItem({ file, load }: AttachedFileItemProps) {
  const { notify } = useFeedback();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      saveFile(await load(), file.fileName);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        notify(FILE_NOT_FOUND_MESSAGE, 'error');
      } else {
        notify(messageOf(error), 'error');
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li>
      <Typography component="span">{file.fileName}</Typography>
      <Typography component="span" color="text.secondary">
        {` (${formatFileSize(file.sizeBytes)}, ${file.contentType}) `}
      </Typography>
      <Button
        size="small"
        startIcon={<DownloadIcon />}
        disabled={downloading}
        aria-label={`${downloading ? 'Baixando' : 'Baixar'} ${file.fileName}`}
        onClick={() => void download()}
      >
        {downloading ? 'Baixando…' : 'Baixar'}
      </Button>
    </li>
  );
}
