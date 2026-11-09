import DownloadIcon from '@mui/icons-material/Download';
import { Button, Typography } from '@mui/material';
import { useState } from 'react';
import { formatFileSize } from '../formatters/fileSize';
import { useFeedback } from '../hooks/useFeedback';
import { downloadSubmissionFile } from '../services/activityService';
import type { SubmissionFile } from '../services/activityService';
import { ApiError, messageOf } from '../services/apiError';
import { saveFile } from './saveFile';

export const FILE_NOT_FOUND_MESSAGE = 'O arquivo não foi encontrado.';

interface SubmissionFileItemProps {
  activityId: number;
  file: SubmissionFile;
}

/** Um arquivo de uma Entrega, com a ação de baixar para o aluno e para o orientador (RF31). */
export function SubmissionFileItem({
  activityId,
  file,
}: SubmissionFileItemProps) {
  const { notify } = useFeedback();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      saveFile(
        await downloadSubmissionFile(activityId, file.id),
        file.fileName,
      );
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
