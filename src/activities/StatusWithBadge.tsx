import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import { Chip, Stack } from '@mui/material';
import type { ActivityStatus } from '../services/activityService';
import { STATUS_CHIP_COLORS, STATUS_LABELS } from './activityStatus';

/**
 * A situação da atividade, em texto ou em pílula (com a cor da situação), e, ao lado dela, o selo "Atrasada" (RN24). O selo vem do servidor e é
 * texto, não só cor; a situação original continua visível.
 */
export function StatusWithBadge({
  status,
  overdue,
  pill = false,
}: {
  status: ActivityStatus;
  overdue: boolean;
  /** A situação em pílula (os cartões da lista) em vez de texto simples (o detalhe). */
  pill?: boolean;
}) {
  return (
    <Stack
      direction="row"
      useFlexGap
      sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
    >
      {pill ? (
        <Chip
          label={STATUS_LABELS[status]}
          color={STATUS_CHIP_COLORS[status]}
          size="small"
          variant="outlined"
        />
      ) : (
        <span>{STATUS_LABELS[status]}</span>
      )}
      {overdue && (
        // Selo suave, com ícone: não é um botão vermelho cheio, e a palavra continua sendo o aviso.
        <Chip
          label="Atrasada"
          color="error"
          size="small"
          variant="outlined"
          icon={<ErrorOutlinedIcon />}
          sx={{ bgcolor: 'error.light', fontWeight: 600 }}
        />
      )}
    </Stack>
  );
}
