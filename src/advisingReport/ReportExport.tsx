import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  Alert,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { saveFile } from '../activities/saveFile';
import { useFeedback } from '../hooks/useFeedback';
import { usePolling } from '../hooks/usePolling';
import { messageOf } from '../services/apiError';
import {
  downloadReportExport,
  getCurrentReportExport,
  requestReportExport,
  type ReportExport as Export,
} from '../services/reportExportService';

/** A geração do PDF leva segundos: a tela a acompanha a cada 2 s (ADR frontend 0007). */
export const EXPORT_POLL_INTERVAL_MS = 2_000;

const GENERATING = 'Gerando o PDF';

const isRunning = (item: Export | null) =>
  item !== null && (item.status === 'queued' || item.status === 'processing');

interface ReportExportProps {
  advisingId: number;
}

/**
 * A Exportação do Relatório da orientação encerrada (RF62, RN50): pede o PDF, acompanha a geração
 * enquanto a pessoa está na tela e oferece o download quando fica pronto.
 */
export function ReportExport({ advisingId }: ReportExportProps) {
  const { notify } = useFeedback();
  const [current, setCurrent] = useState<Export | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentReportExport(advisingId)
      .then((item) => {
        if (active) setCurrent(item);
      })
      // Sem a situação, a tela oferece o botão de exportar, como se não houvesse exportação.
      .catch(() => {
        if (active) setCurrent(null);
      });
    return () => {
      active = false;
    };
  }, [advisingId]);

  usePolling(
    () => {
      getCurrentReportExport(advisingId)
        .then(setCurrent)
        // Uma consulta perdida não muda nada: a seguinte tenta de novo.
        .catch(() => undefined);
    },
    {
      intervalMs: EXPORT_POLL_INTERVAL_MS,
      enabled: isRunning(current ?? null),
      pollOnStart: false,
    },
  );

  const ask = async () => {
    setBusy(true);
    try {
      setCurrent(await requestReportExport(advisingId));
    } catch (error) {
      notify(messageOf(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async (fileName: string) => {
    setBusy(true);
    try {
      saveFile(await downloadReportExport(advisingId), fileName);
    } catch (error) {
      notify(messageOf(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (current === undefined) return null;
  const readyFileName = current?.status === 'ready' ? current.fileName : null;

  return (
    <Stack spacing={1} aria-live="polite">
      {isRunning(current) && (
        <>
          <Typography>{GENERATING}…</Typography>
          <LinearProgress aria-label={GENERATING} />
        </>
      )}
      {readyFileName !== null && (
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          disabled={busy}
          onClick={() => void download(readyFileName)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Baixar PDF
        </Button>
      )}
      {current?.status === 'failed' && (
        <>
          <Alert severity="error">Não foi possível gerar o PDF.</Alert>
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => void ask()}
            sx={{ alignSelf: 'flex-start' }}
          >
            Tentar de novo
          </Button>
        </>
      )}
      {current === null && (
        <Button
          variant="outlined"
          startIcon={<PictureAsPdfIcon />}
          disabled={busy}
          onClick={() => void ask()}
          sx={{ alignSelf: 'flex-start' }}
        >
          Exportar PDF
        </Button>
      )}
    </Stack>
  );
}
