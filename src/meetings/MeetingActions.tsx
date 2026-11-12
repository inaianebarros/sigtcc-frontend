import { Button, Stack } from '@mui/material';
import type { MeetingItem } from '../services/meetingService';

interface MeetingActionHandlers {
  onAccept: (item: MeetingItem) => void;
  onReject: (item: MeetingItem) => void;
  onEdit: (item: MeetingItem) => void;
  onCancel: (item: MeetingItem) => void;
  onMarkHeld: (item: MeetingItem) => void;
  onEditNotes: (item: MeetingItem) => void;
}

interface MeetingActionsProps extends MeetingActionHandlers {
  item: MeetingItem;
  /** Há um pedido em curso: as ações de todas as linhas ficam paradas até ele terminar. */
  busy: boolean;
}

/**
 * As ações de uma reunião (RF20 a RF22, RF57 e RF58). Cada uma aparece só quando o servidor a permite: a tela
 * não repete as regras (RN09 a RN11), só segue as flags `can_*` da lista.
 */
export function MeetingActions({
  item,
  busy,
  onAccept,
  onReject,
  onEdit,
  onCancel,
  onMarkHeld,
  onEditNotes,
}: MeetingActionsProps) {
  if (
    !item.canAnswer &&
    !item.canEdit &&
    !item.canCancel &&
    !item.canMarkHeld &&
    !item.canEditNotes
  )
    return null;
  const subject = `a reunião "${item.description}"`;
  return (
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
      {item.canAnswer && (
        <>
          <Button
            size="small"
            variant="contained"
            disabled={busy}
            aria-label={`Aceitar ${subject}`}
            onClick={() => onAccept(item)}
          >
            Aceitar
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={busy}
            aria-label={`Recusar ${subject}`}
            onClick={() => onReject(item)}
          >
            Recusar
          </Button>
        </>
      )}
      {item.canEdit && (
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          aria-label={`Editar ${subject}`}
          onClick={() => onEdit(item)}
        >
          Editar
        </Button>
      )}
      {item.canMarkHeld && (
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          aria-label={`Marcar como realizada ${subject}`}
          onClick={() => onMarkHeld(item)}
        >
          Marcar como realizada
        </Button>
      )}
      {item.canEditNotes && (
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          aria-label={`${item.notes ? 'Editar' : 'Adicionar'} apontamentos da reunião "${item.description}"`}
          onClick={() => onEditNotes(item)}
        >
          {item.notes ? 'Editar apontamentos' : 'Adicionar apontamentos'}
        </Button>
      )}
      {item.canCancel && (
        <Button
          size="small"
          variant="outlined"
          color="error"
          disabled={busy}
          aria-label={`Cancelar ${subject}`}
          onClick={() => onCancel(item)}
        >
          Cancelar
        </Button>
      )}
    </Stack>
  );
}
