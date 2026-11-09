import { Button, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type { ActivityStatus } from '../services/activityService';
import { StatusControl } from './StatusControl';
import type { StudentSettableStatus } from './StatusControl';

export const AWAITING_REVIEW_MESSAGE =
  'Aguardando a revisão do orientador: você não altera o status agora';
export const COMPLETED_MESSAGE = 'Atividade concluída';
export const NO_DELIVERY_REASON =
  'Entregue ao menos um arquivo para enviar para revisão';

interface StatusAndDeliveryProps {
  status: ActivityStatus;
  statusBusy: boolean;
  /** A atividade já tem ao menos uma Entrega: sem ela não há o que enviar para revisão (RF28). */
  hasDelivery: boolean;
  onChangeStatus: (status: StudentSettableStatus) => void;
  onDeliver: () => void;
  onSendForReview: () => void;
}

/** O que o aluno faz com a atividade (RF28): o controle de status, ou por que ele não existe. */
export function StatusAndDelivery({
  status,
  statusBusy,
  hasDelivery,
  onChangeStatus,
  onDeliver,
  onSendForReview,
}: StatusAndDeliveryProps) {
  const reasonId = useId();
  if (status === 'in_review') {
    return <Typography>{AWAITING_REVIEW_MESSAGE}</Typography>;
  }
  if (status === 'completed') {
    return <Typography>{COMPLETED_MESSAGE}</Typography>;
  }
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <StatusControl
        status={status}
        busy={statusBusy}
        onChange={onChangeStatus}
      />
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={onDeliver}>
          Entregar arquivos
        </Button>
        <Button
          variant="contained"
          disabled={!hasDelivery}
          aria-disabled={!hasDelivery}
          aria-describedby={hasDelivery ? undefined : reasonId}
          onClick={onSendForReview}
        >
          Enviar para revisão
        </Button>
      </Stack>
      {!hasDelivery && (
        <Typography id={reasonId} variant="body2" color="text.secondary">
          {NO_DELIVERY_REASON}
        </Typography>
      )}
    </Stack>
  );
}
