import { Button, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type {
  ActivityStatus,
  StudentSettableStatus,
} from '../services/activityService';
import { StatusControl } from './StatusControl';

export const AWAITING_REVIEW_MESSAGE =
  'O orientador está revisando. Enquanto isso, você não pode entregar arquivos nem mudar a situação. Se a revisão for recusada, a atividade volta para Pendente.';
export const COMPLETED_MESSAGE =
  'O orientador aceitou esta atividade. Não há mais nada a fazer nela.';
export const DELIVERY_GUIDANCE =
  'Entregue os arquivos do trabalho. Quando terminar, envie a atividade para o orientador revisar.';
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

/** O que o aluno faz com a atividade (RF28): o controle da situação, ou por que ele não existe. */
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
      <Stack
        direction="row"
        useFlexGap
        sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
      >
        {/* O nome acessível do grupo, "Situação da atividade", já contém o rótulo visível. */}
        <Typography aria-hidden>Situação:</Typography>
        <StatusControl
          status={status}
          busy={statusBusy}
          onChange={onChangeStatus}
        />
      </Stack>
      <Typography>{DELIVERY_GUIDANCE}</Typography>
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
