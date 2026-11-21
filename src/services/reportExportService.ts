import { httpClient } from './httpClient';

export type ReportExportStatus = 'queued' | 'processing' | 'ready' | 'failed';

/** Uma Exportação do Relatório pedida pelo próprio usuário (RF62, RN50). */
export interface ReportExport {
  id: number;
  status: ReportExportStatus;
  createdAt: string;
  /** Quando o PDF ficou pronto; `null` antes disso. */
  readyAt: string | null;
  /** O nome do arquivo do PDF pronto; `null` antes disso. */
  fileName: string | null;
}

interface ApiReportExport {
  id: number;
  status: ReportExportStatus;
  created_at: string;
  ready_at: string | null;
  file_name: string | null;
}

const exportPath = (advisingId: number) =>
  `/orientacao/historico/${advisingId}/exportacao`;

function fromApi(item: ApiReportExport): ReportExport {
  return {
    id: item.id,
    status: item.status,
    createdAt: item.created_at,
    readyAt: item.ready_at,
    fileName: item.file_name,
  };
}

/** A última exportação que o usuário pediu para a orientação encerrada, ou `null`. */
export async function getCurrentReportExport(
  advisingId: number,
): Promise<ReportExport | null> {
  const item = await httpClient.get<ApiReportExport | null>(
    exportPath(advisingId),
  );
  return item === null ? null : fromApi(item);
}

/** Pede a exportação do relatório; o PDF é gerado fora da tela (ADR backend 0027). */
export async function requestReportExport(
  advisingId: number,
): Promise<ReportExport> {
  return fromApi(
    await httpClient.post<ApiReportExport>(exportPath(advisingId)),
  );
}

/** O conteúdo do PDF pronto, por requisição autenticada; só quem pediu o baixa. */
export function downloadReportExport(advisingId: number): Promise<Blob> {
  return httpClient.download(`${exportPath(advisingId)}/pdf`);
}
