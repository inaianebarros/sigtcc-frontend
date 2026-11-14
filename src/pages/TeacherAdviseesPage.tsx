import {
  Alert,
  Button,
  Chip,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { AdviseeActionsMenu } from '../advisees/AdviseeActionsMenu';
import { AdviseeCard } from '../advisees/AdviseeCard';
import {
  EndAdvisingDialog,
  REASON_REJECTED_MESSAGE,
} from '../advisees/EndAdvisingDialog';
import { PagePagination } from '../components/PagePagination';
import { UrlSearchField } from '../components/UrlSearchField';
import { useDialogSlot } from '../hooks/useDialogSlot';
import { useFeedback } from '../hooks/useFeedback';
import { useLoad } from '../hooks/useLoad';
import { usePageBounds } from '../hooks/usePageBounds';
import { useSession } from '../hooks/useSession';
import {
  PAGE_PARAM,
  useReturnToLastPage,
  useUrlPage,
} from '../hooks/useUrlPage';
import {
  ApiError,
  isStateChangedError,
  messageForStatus,
} from '../services/apiError';
import { paths, teacherStudentPath } from '../navigation/paths';
import { OriginLink } from '../navigation/OriginLink';
import {
  ADVISEES_SCREEN_PAGE_SIZE,
  endAdvising,
  listAdviseesByText,
} from '../services/adviseeService';
import type { Advisee } from '../services/adviseeService';
import { ThesisTopicDialog } from '../thesis/ThesisTopicDialog';

function foundText(count: number): string {
  return `${count} ${count === 1 ? 'orientando encontrado' : 'orientandos encontrados'}`;
}

const SEARCH_PARAM = 'busca';

function totalText(count: number): string {
  return `${count} ${count === 1 ? 'orientando' : 'orientandos'}`;
}

export function TeacherAdviseesPage() {
  const [reload, setReload] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = (searchParams.get(SEARCH_PARAM) ?? '').trim();
  const [page, setPage] = useUrlPage();
  const listTop = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeadingAfterClose = useRef(false);
  const { notify } = useFeedback();
  // O diálogo do tema: o orientando escolhido fica guardado para o diálogo sair com ele.
  const topicDialog = useDialogSlot<Advisee>();
  const { user, refreshUser } = useSession();
  const activeCount = user?.activeAdviseesCount;
  // `openCount` muda a cada abertura, para o diálogo começar com o motivo vazio.
  const [dialog, setDialog] = useState<{
    advisee: Advisee;
    open: boolean;
    openCount: number;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const list = useLoad(
    () => listAdviseesByText(page, search),
    `${page}|${search}|${reload}`,
  );

  const { knownCount, lastPage, fallbackPage } = usePageBounds(
    list,
    ADVISEES_SCREEN_PAGE_SIZE,
    page,
  );

  useReturnToLastPage(fallbackPage, page, setPage);

  const changeSearch = (next: string) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(PAGE_PARAM);
      if (next === '') params.delete(SEARCH_PARAM);
      else params.set(SEARCH_PARAM, next);
      return params;
    });
  // Sem nenhum orientando ativo a busca não serve para nada: o campo fica escondido.
  const noAdvisees =
    activeCount === 0 ||
    (list.status === 'ready' && list.data.count === 0 && search === '');

  const clearErrors = () => {
    setFailure(null);
    setReasonError(null);
  };

  const closeDialog = () =>
    setDialog((current) => current && { ...current, open: false });

  const confirmEnd = async (reason: string) => {
    if (!dialog || sending) return;
    const { advisingId } = dialog.advisee;
    setSending(true);
    clearErrors();
    try {
      await endAdvising(advisingId, reason);
      closeDialog();
      notify('Orientação encerrada.', 'success');
      setReload((current) => current + 1);
      void refreshUser();
      // O cartão do aluno some da lista: o foco vai para o título, quando o diálogo sair.
      focusHeadingAfterClose.current = true;
    } catch (error) {
      if (isStateChangedError(error)) {
        // A situação mudou: a lista é lida de novo e o diálogo não faz mais sentido.
        closeDialog();
        notify(
          error.status === 404
            ? 'Orientação não encontrada.'
            : 'Orientação já encerrada.',
          'error',
        );
        setReload((current) => current + 1);
      } else if (
        error instanceof ApiError &&
        (error.status === 400 || error.status === 422) &&
        error.fieldErrors.reason
      ) {
        setReasonError(REASON_REJECTED_MESSAGE);
      } else {
        setFailure(
          error instanceof ApiError ? error.message : messageForStatus(0),
        );
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack spacing={3}>
      <div>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 2 }}
        >
          <Typography variant="h4" component="h1" ref={heading} tabIndex={-1}>
            Meus orientandos
          </Typography>
          {activeCount !== undefined && <Chip label={totalText(activeCount)} />}
        </Stack>
        <Typography color="text.secondary">
          Acompanhe suas orientações ativas.
        </Typography>
      </div>
      {!noAdvisees && (
        <UrlSearchField
          label="Buscar orientando"
          placeholder="Digite o nome do aluno ou o tema do TCC..."
          value={search}
          onSearch={changeSearch}
        />
      )}
      {/* Uma frase curta numa região própria: reler a lista inteira a cada página seria ruído. */}
      <Typography role="status" aria-live="polite" color="text.secondary">
        {list.status === 'ready' && list.data.count > 0
          ? foundText(list.data.count)
          : ''}
      </Typography>
      <div ref={listTop}>
        {list.status === 'loading' && (
          <Stack spacing={2} data-testid="advisees-skeleton" aria-hidden>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={170} />
            ))}
          </Stack>
        )}
        {list.status === 'error' && (
          <Stack spacing={2}>
            <Alert severity="error">{list.message}</Alert>
            <Button
              onClick={() => setReload((current) => current + 1)}
              sx={{ alignSelf: 'flex-start' }}
            >
              Tentar novamente
            </Button>
          </Stack>
        )}
        {list.status === 'ready' && list.data.count === 0 && search !== '' && (
          <Stack spacing={2}>
            <Alert severity="info">
              Nenhum orientando encontrado com esse texto
            </Alert>
            <Button
              onClick={() => changeSearch('')}
              sx={{ alignSelf: 'flex-start' }}
            >
              Limpar busca
            </Button>
          </Stack>
        )}
        {list.status === 'ready' && list.data.count === 0 && search === '' && (
          <Alert severity="info">
            Você ainda não tem orientandos ativos.{' '}
            <Link component={RouterLink} to={paths.teacherRequests}>
              Ver as solicitações recebidas
            </Link>
          </Alert>
        )}
        {list.status === 'ready' && list.data.items.length > 0 && (
          <Stack spacing={2}>
            {list.data.items.map((advisee) => (
              <AdviseeCard
                key={advisee.advisingId}
                advisee={advisee}
                wrapName={(name, item) => (
                  <OriginLink to={teacherStudentPath(item.student.id)}>
                    {name}
                  </OriginLink>
                )}
                menu={
                  <AdviseeActionsMenu
                    studentName={advisee.student.fullName}
                    onEnd={() => {
                      clearErrors();
                      setDialog((current) => ({
                        advisee,
                        open: true,
                        openCount: (current?.openCount ?? 0) + 1,
                      }));
                    }}
                  />
                }
                actions={
                  <>
                    <Button
                      component={RouterLink}
                      to={`${paths.teacherActivities}?aluno=${advisee.student.id}`}
                      variant="outlined"
                      aria-label={`Ver atividades de ${advisee.student.fullName}`}
                    >
                      Ver atividades
                    </Button>
                    <Button
                      variant="outlined"
                      aria-label={`${advisee.thesisTopic ? 'Editar tema' : 'Cadastrar tema'} de ${advisee.student.fullName}`}
                      onClick={() => topicDialog.show(advisee)}
                    >
                      {advisee.thesisTopic ? 'Editar tema' : 'Cadastrar tema'}
                    </Button>
                  </>
                }
              />
            ))}
          </Stack>
        )}
      </div>
      <PagePagination
        ariaLabel="Paginação dos orientandos"
        knownCount={knownCount}
        pageSize={ADVISEES_SCREEN_PAGE_SIZE}
        lastPage={lastPage}
        page={page}
        onChange={(next) => {
          setPage(next);
          listTop.current?.scrollIntoView?.({ block: 'start' });
        }}
      />
      {topicDialog.slot && (
        <ThesisTopicDialog
          key={topicDialog.slot.openCount}
          advisee={{
            id: topicDialog.slot.payload.student.id,
            name: topicDialog.slot.payload.student.fullName,
          }}
          open={topicDialog.slot.open}
          onSaved={() => {
            topicDialog.hide();
            notify('Tema salvo.', 'success');
            setReload((current) => current + 1);
          }}
          onStateChanged={() => {
            // O diálogo fica aberto, com o aviso: a sessão e a lista é que se atualizam.
            void refreshUser();
            setReload((current) => current + 1);
          }}
          onClose={topicDialog.hide}
          onExited={topicDialog.unmount}
        />
      )}
      {dialog && (
        <EndAdvisingDialog
          key={dialog.openCount}
          open={dialog.open}
          studentName={dialog.advisee.student.fullName}
          busy={sending}
          failure={failure}
          reasonError={reasonError}
          onEdit={clearErrors}
          onCancel={closeDialog}
          onConfirm={confirmEnd}
          onExited={() => {
            if (!focusHeadingAfterClose.current) return;
            focusHeadingAfterClose.current = false;
            heading.current?.focus();
          }}
        />
      )}
    </Stack>
  );
}
