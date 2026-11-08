import {
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { RequestStatusChip } from '../advisingRequests/requestStatus';
import { formatDate, formatDateTime } from '../formatters/dateTime';
import type {
  AnswerAction,
  ReceivedRequest,
} from '../services/teacherRequestService';

/** Por que uma solicitação sem botões não pode mais ser respondida (RN06 e RN20). */
function whyNoButtons(status: ReceivedRequest['status']): string {
  if (status === 'unanswered') {
    return 'O prazo para responder acabou, e a solicitação não pode mais ser respondida.';
  }
  return 'Esta solicitação já foi respondida e não pode ser alterada.';
}

interface RequestItemProps {
  request: ReceivedRequest;
  /** Para a tela levar o foco ao cartão depois de uma resposta. */
  cardRef: (element: HTMLElement | null) => void;
  /** O nome do aluno, que a tela transforma no link para o perfil dele (RF11). */
  wrapName: (name: string, request: ReceivedRequest) => ReactNode;
  onAnswer: (request: ReceivedRequest, action: AnswerAction) => void;
}

/** O cartão de uma solicitação recebida, com Aceitar e Recusar só enquanto ela é respondível. */
export function RequestItem({
  request,
  cardRef,
  wrapName,
  onAnswer,
}: RequestItemProps) {
  const titleId = useId();
  const { student } = request;
  const pending = request.status === 'pending';
  return (
    <Card
      component="article"
      aria-labelledby={titleId}
      variant="outlined"
      ref={cardRef}
      tabIndex={-1}
      sx={{
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
        },
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Typography id={titleId} variant="h6" component="h2">
            {wrapName(student.fullName, request)}
          </Typography>
          <Typography color="text.secondary">{student.course.name}</Typography>
          {student.areas.length > 0 && (
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
              {student.areas.map((area) => (
                <Chip key={area.id} label={area.name} size="small" />
              ))}
            </Stack>
          )}
          <Typography color="text.secondary">
            Enviada em {formatDate(request.requestedAt)}
          </Typography>
          {request.respondedAt && (
            <Typography color="text.secondary">
              Respondida em {formatDate(request.respondedAt)}
            </Typography>
          )}
          <div>
            <RequestStatusChip status={request.status} />
          </div>
          {pending && request.expiresAt && (
            <Typography>
              Prazo para responder: {formatDateTime(request.expiresAt)}.
            </Typography>
          )}
          {!pending && <Typography>{whyNoButtons(request.status)}</Typography>}
        </Stack>
      </CardContent>
      {pending && (
        <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => onAnswer(request, 'accept')}
          >
            Aceitar
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => onAnswer(request, 'reject')}
          >
            Recusar
          </Button>
        </CardActions>
      )}
    </Card>
  );
}
