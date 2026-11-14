import { Alert, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { ReportNavigation } from '../advisingReport/ReportNavigation';
import { RecordsSection } from '../advisingReport/RecordsSection';
import { ReportHeader } from '../advisingReport/ReportHeader';
import { ReportSummary } from '../advisingReport/ReportSummary';
import { useLoad } from '../hooks/useLoad';
import { useSession } from '../hooks/useSession';
import { originPath } from '../navigation/origin';
import { paths } from '../navigation/paths';
import { positiveIntFrom } from '../navigation/positiveInt';
import { NotFoundPage } from './NotFoundPage';
import { getAdvisingReport } from '../services/advisingReportService';

/** O relatório de uma orientação encerrada, para o aluno e para o professor (RF61). */
export function AdvisingReportPage() {
  const { advisingId } = useParams();
  const id = positiveIntFrom(advisingId);
  const { user } = useSession();
  const isStudent = user?.type === 'student';
  const historyPath =
    originPath(useLocation().state, isStudent ? 'aluno' : 'professor') ??
    (isStudent ? paths.studentAdvisingHistory : paths.teacherAdvisingHistory);
  const [reload, setReload] = useState(0);
  // Sem um id válido a API nem é chamada: a chave nula deixa a carga parada.
  const report = useLoad(
    () => (id === null ? Promise.resolve(null) : getAdvisingReport(id)),
    id === null ? null : `${id}|${reload}`,
  );
  // O servidor responde o mesmo 404 para qualquer caso (RN47): a tela não diz o motivo.
  if (id === null || (report.status === 'ready' && report.data === null)) {
    return <NotFoundPage />;
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 960, mx: 'auto' }}>
      <ReportNavigation
        historyPath={historyPath}
        name={
          report.status === 'ready' && report.data !== null
            ? report.data.counterpart.fullName
            : undefined
        }
      />
      <Typography variant="h4" component="h1">
        Relatório da orientação
      </Typography>
      {report.status === 'loading' && (
        <Stack spacing={2} data-testid="report-skeleton" aria-hidden>
          <Skeleton variant="rounded" height={260} />
          <Skeleton variant="rounded" height={104} />
        </Stack>
      )}
      {report.status === 'error' && (
        <Stack spacing={2}>
          <Alert severity="error">{report.message}</Alert>
          <Button
            onClick={() => setReload((current) => current + 1)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Tentar novamente
          </Button>
        </Stack>
      )}
      {report.status === 'ready' && report.data !== null && (
        <>
          <ReportHeader report={report.data} />
          <ReportSummary report={report.data} />
          <RecordsSection advisingId={report.data.id} />
        </>
      )}
    </Stack>
  );
}
