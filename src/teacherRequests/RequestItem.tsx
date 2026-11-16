import {
  Button,
  Card,
  CardActions,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import { VisuallyHidden } from '../components/VisuallyHidden';
import { AreaChips } from '../profile/AreaChips';
import type { ReactNode } from 'react';
import { RequestStatusChip } from '../advisingRequests/requestStatus';
import { statusChipColor } from '../advisingRequests/requestStatusDisplay';
import type {
  AnswerAction,
  ReceivedRequest,
} from '../services/teacherRequestService';
import { receivedRequestDateLines } from './requestDateLines';

interface RequestItemProps {
  request: ReceivedRequest;
  /** Para a tela levar o foco ao cartão depois de uma resposta. */
  cardRef: (element: HTMLElement | null) => void;
  /** O nome do aluno, que a tela transforma no link para o perfil dele (RF11). */
  wrapName: (name: string, request: ReceivedRequest) => ReactNode;
  onAnswer: (request: ReceivedRequest, action: AnswerAction) => void;
}

/**
 * O cartão de uma solicitação recebida (RF13), no mesmo formato do cartão do aluno: o aluno, com o
 * curso e as áreas, a situação e as datas. Aceitar e Recusar só aparecem enquanto ela é
 * respondível (RN06 e RN20).
 */
export function RequestItem({
  request,
  cardRef,
  wrapName,
  onAnswer,
}: RequestItemProps) {
  const titleId = useId();
  const areasId = useId();
  const { student } = request;
  const pending = request.status === 'pending';
  return (
    <Card
      component="article"
      aria-labelledby={titleId}
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
          <Stack spacing={0.25}>
            <Typography
              id={titleId}
              variant="h3"
              component="h2"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {wrapName(student.fullName, request)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {student.course.name}
            </Typography>
          </Stack>
          {student.areas.length > 0 && (
            <>
              <VisuallyHidden id={areasId}>
                Áreas de interesse de {student.fullName}
              </VisuallyHidden>
              <AreaChips
                areas={student.areas}
                labelledBy={areasId}
                announceCount
              />
            </>
          )}
          <div>
            <RequestStatusChip
              status={request.status}
              color={statusChipColor(request.status)}
            />
          </div>
          <Stack
            component="ul"
            spacing={0.25}
            sx={{ m: 0, p: 0, listStyle: 'none' }}
          >
            {receivedRequestDateLines(request).map((line) => (
              <Typography
                component="li"
                key={line}
                variant="body2"
                color="text.secondary"
              >
                {line}
              </Typography>
            ))}
          </Stack>
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
