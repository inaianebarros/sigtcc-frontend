import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { saveFile } from '../activities/saveFile';
import { FOCUS_RING } from '../theme';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { formatDayMonthTime } from '../formatters/dateTime';
import { useFeedback } from '../hooks/useFeedback';
import { usePolling } from '../hooks/usePolling';
import { ApiError } from '../services/apiError';
import { markNotificationRead } from '../services/notificationService';
import {
  downloadReportExport,
  getCurrentReportExport,
  requestReportExport,
  type ReportExport as Export,
} from '../services/reportExportService';

/** A geração do PDF leva segundos: a tela a acompanha a cada 2 s (ADR frontend 0007). */
export const EXPORT_POLL_INTERVAL_MS = 2_000;

const BAR_LABEL = 'Progresso do PDF do relatório';
const SUPPORT =
  'O PDF traz o relatório completo: todas as reuniões realizadas e atividades concluídas ou arquivadas, sem o filtro e sem a página escolhidos na tela. Os arquivos entregues não vão no PDF, só os nomes deles.';
const LEAVE =
  'O PDF é montado aos poucos. Você pode sair desta tela: avisaremos por notificação quando ele ficar pronto.';
const REQUEST_FAILED =
  'Não foi possível pedir o PDF agora. Tente novamente em alguns instantes.';
const DOWNLOAD_FAILED = 'Não foi possível baixar o PDF agora. Tente novamente.';
const EXPIRED = 'Este PDF expirou. Gere um novo pelo botão Exportar PDF.';
const EXPIRED_ANNOUNCEMENT =
  'Este PDF expirou. Use o botão Exportar PDF para gerar um novo.';
const NOT_READY =
  'O PDF ainda não está pronto. Aguarde o fim da geração nesta tela.';

/** O anúncio de cada etapa: só a mudança de etapa, nunca a contagem (ficha 20). */
const STAGE_ANNOUNCEMENTS: Record<Export['stage'], string> = {
  queued: 'PDF do relatório pedido. Etapa 1 de 3: na fila.',
  gathering: 'Etapa 2 de 3: reunindo reuniões e atividades.',
  rendering: 'Etapa 3 de 3: gerando o PDF.',
};

// Sem a data, o formatador já diz "data indisponível".
const availableUntil = (item: Export) =>
  formatDayMonthTime(item.availableUntil ?? '');

/** O elemento que recebe o foco ao aparecer, quando o que o tinha sumiu. */
type FocusTarget = 'stage' | 'download' | 'export';

const isRunning = (item: Export | null | undefined): item is Export =>
  item != null && (item.status === 'queued' || item.status === 'processing');

function stageText(item: Export): string {
  switch (item.stage) {
    case 'queued':
      return 'Etapa 1 de 3: Na fila';
    case 'gathering':
      return `Etapa 2 de 3: Reunindo reuniões e atividades (${item.itemsDone} de ${item.itemsTotal})`;
    case 'rendering':
      return 'Etapa 3 de 3: Gerando o PDF';
  }
}

interface BusyButtonProps {
  busy: boolean;
  icon: ReactNode;
  variant: 'outlined' | 'contained';
  onClick: () => void;
  children: string;
  /** Para levar o foco ao botão quando o elemento que o tinha some (especificação, seção 6). */
  buttonRef?: (node: HTMLButtonElement | null) => void;
}

/**
 * Um botão que, ocupado, ignora cliques sem `disabled`, para quem usa teclado não perder o foco
 * (especificação de UI, D7).
 */
function BusyButton({
  busy,
  icon,
  variant,
  onClick,
  children,
  buttonRef,
}: BusyButtonProps) {
  return (
    <Button
      ref={buttonRef}
      variant={variant}
      startIcon={busy ? <CircularProgress size={20} color="inherit" /> : icon}
      aria-busy={busy}
      aria-disabled={busy}
      onClick={() => {
        if (!busy) onClick();
      }}
      sx={{ alignSelf: 'flex-start', minHeight: { xs: 44, sm: 40 } }}
    >
      {children}
    </Button>
  );
}

/**
 * A barra de cada etapa (especificação de UI, D5): determinada só na etapa 2, quando há itens a
 * contar; o valor em texto é sempre o da etapa.
 */
function StageBar({ item }: { item: Export }) {
  const counted = item.stage === 'gathering' && item.itemsTotal > 0;
  return (
    <LinearProgress
      variant={counted ? 'determinate' : 'indeterminate'}
      value={
        counted
          ? Math.floor((item.itemsDone / item.itemsTotal) * 100)
          : undefined
      }
      aria-label={BAR_LABEL}
      aria-valuetext={stageText(item)}
      sx={{
        height: 8,
        borderRadius: '4px',
        bgcolor: 'divider',
        '@media (prefers-reduced-motion: reduce)': {
          '& .MuiLinearProgress-bar': { animation: 'none', width: '40%' },
        },
      }}
    />
  );
}

interface ReportExportProps {
  advisingId: number;
}

/**
 * A Exportação do Relatório da orientação encerrada (RF62, RN50): pede o PDF, acompanha a geração
 * por etapas enquanto a pessoa está na tela e oferece o download quando fica pronto.
 */
export function ReportExport({ advisingId }: ReportExportProps) {
  const { notify } = useFeedback();
  const [current, setCurrent] = useState<Export | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // Depois de pedir, o bloco mantém a altura da geração, para "Gerando → Pronta" não puxar a tela.
  const [requested, setRequested] = useState(false);
  // O foco só se move quando o elemento que o tinha some (especificação de UI, seção 6): o que
  // aparece no lugar dele o recebe ao montar.
  const focusNext = useRef<FocusTarget | null>(null);
  const stageNode = useRef<HTMLParagraphElement | null>(null);
  const takeFocus = (target: FocusTarget, node: HTMLElement | null) => {
    if (node && focusNext.current === target) {
      focusNext.current = null;
      node.focus();
    }
  };
  const stageLine = useCallback((node: HTMLParagraphElement | null) => {
    stageNode.current = node;
    takeFocus('stage', node);
  }, []);
  const downloadButton = useCallback(
    (node: HTMLButtonElement | null) => takeFocus('download', node),
    [],
  );
  const exportButton = useCallback(
    (node: HTMLButtonElement | null) => takeFocus('export', node),
    [],
  );

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

  // Ao abrir a tela já num estado nada é anunciado; só as mudanças que acontecem com ela aberta.
  const follow = (next: Export | null) => {
    if (isRunning(next) && isRunning(current) && next.stage !== current.stage) {
      setAnnouncement(STAGE_ANNOUNCEMENTS[next.stage]);
    }
    if (next?.status === 'ready' && isRunning(current)) {
      setAnnouncement(
        `PDF pronto. Use o botão Baixar PDF. Disponível até ${availableUntil(next)}.`,
      );
      if (stageNode.current?.contains(document.activeElement)) {
        focusNext.current = 'download';
      }
    }
    setCurrent(next);
  };

  // Quem viu o PDF pronto na tela não precisa da notificação nem do e-mail dela (RN50): a tela a
  // marca como lida uma vez, ao mostrar o resultado.
  const markedRead = useRef(new Set<number>());
  const readyNotification =
    current?.status === 'ready' ? current.notificationId : null;
  useEffect(() => {
    if (readyNotification === null) return;
    if (markedRead.current.has(readyNotification)) return;
    markedRead.current.add(readyNotification);
    // Se falhar, a notificação continua não lida e o e-mail sai, o que só repete o aviso.
    markNotificationRead(readyNotification).catch(() => undefined);
  }, [readyNotification]);

  usePolling(
    () => {
      getCurrentReportExport(advisingId)
        .then(follow)
        // Uma consulta perdida não muda nada: a seguinte tenta de novo.
        .catch(() => undefined);
    },
    {
      intervalMs: EXPORT_POLL_INTERVAL_MS,
      enabled: isRunning(current),
      pollOnStart: false,
    },
  );

  const ask = async () => {
    setBusy(true);
    try {
      const item = await requestReportExport(advisingId);
      setCurrent(item);
      if (item.status === 'ready') {
        // Uma exportação pronta reaproveitada (RN50): o botão clicado some, e o foco vai para Baixar.
        focusNext.current = 'download';
      } else if (isRunning(item)) {
        setAnnouncement(STAGE_ANNOUNCEMENTS[item.stage]);
        setRequested(true);
        focusNext.current = 'stage';
      }
    } catch {
      notify(REQUEST_FAILED, 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async (fileName: string) => {
    setBusy(true);
    try {
      saveFile(await downloadReportExport(advisingId), fileName);
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) {
        // O PDF venceu com a tela aberta: o bloco passa a Expirada, sem aviso temporário (ficha 20).
        setCurrent((previous) =>
          previous ? { ...previous, status: 'expired' } : previous,
        );
        setAnnouncement(EXPIRED_ANNOUNCEMENT);
        focusNext.current = 'export';
      } else {
        notify(
          error instanceof ApiError && error.status === 409
            ? NOT_READY
            : DOWNLOAD_FAILED,
          'error',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const readyFileName = current?.status === 'ready' ? current.fileName : null;

  return (
    <Box sx={{ maxWidth: '40rem', minHeight: requested ? 112 : undefined }}>
      <VisuallyHidden
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="report-export-announcer"
      >
        {announcement}
      </VisuallyHidden>
      {current === undefined && (
        <Skeleton
          variant="rounded"
          width={140}
          height={40}
          aria-hidden
          data-testid="report-export-skeleton"
        />
      )}
      {isRunning(current) && (
        <Stack spacing={1}>
          <Typography
            ref={stageLine}
            tabIndex={-1}
            sx={{
              fontWeight: 600,
              fontSize: '0.9375rem',
              overflowWrap: 'anywhere',
              '&:focus-visible, &:focus': FOCUS_RING,
            }}
          >
            {stageText(current)}
          </Typography>
          <StageBar item={current} />
          <Typography variant="body2" color="text.secondary">
            {LEAVE}
          </Typography>
        </Stack>
      )}
      {current?.status === 'ready' && readyFileName !== null && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CheckCircleOutlinedIcon
              aria-hidden
              sx={{ fontSize: 20, color: 'success.main' }}
            />
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              {`PDF pronto. Disponível para baixar até ${availableUntil(current)}.`}
            </Typography>
          </Stack>
          <BusyButton
            busy={busy}
            variant="contained"
            icon={<FileDownloadOutlinedIcon />}
            onClick={() => void download(readyFileName)}
            buttonRef={downloadButton}
          >
            Baixar PDF
          </BusyButton>
        </Stack>
      )}
      {current?.status === 'expired' && (
        <Stack spacing={2}>
          <Alert severity="warning">{EXPIRED}</Alert>
          <BusyButton
            busy={busy}
            variant="outlined"
            icon={<PictureAsPdfOutlinedIcon />}
            onClick={() => void ask()}
            buttonRef={exportButton}
          >
            Exportar PDF
          </BusyButton>
        </Stack>
      )}
      {current?.status === 'failed' && (
        <Stack spacing={2}>
          <Alert severity="error">Não foi possível gerar o PDF.</Alert>
          <BusyButton
            busy={busy}
            variant="outlined"
            icon={<PictureAsPdfOutlinedIcon />}
            onClick={() => void ask()}
          >
            Tentar de novo
          </BusyButton>
        </Stack>
      )}
      {current === null && (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {SUPPORT}
          </Typography>
          <BusyButton
            busy={busy}
            variant="outlined"
            icon={<PictureAsPdfOutlinedIcon />}
            onClick={() => void ask()}
          >
            Exportar PDF
          </BusyButton>
        </Stack>
      )}
    </Box>
  );
}
