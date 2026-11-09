import {
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatDateTime } from '../formatters/dateTime';
import type { MeetingItem } from '../services/meetingService';
import { SituationChip } from './SituationChip';

interface MeetingListProps {
  items: MeetingItem[];
  /** O id do usuário logado: quem solicitou é "Você" ou o nome da outra parte. */
  userId: number;
  /** O ponto de encaixe das ações de uma reunião (responder, editar e cancelar, na #112). */
  renderActions?: (item: MeetingItem) => ReactNode;
}

const truncated = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/** A descrição cortada com reticências por CSS, adaptada à largura, com o texto inteiro no tooltip. */
function TruncatedText({ text }: { text: string }) {
  return (
    <Tooltip title={text} placement="top-start">
      <Typography component="span" sx={truncated}>
        {text}
      </Typography>
    </Tooltip>
  );
}

function requestedBy(item: MeetingItem, userId: number): string {
  return item.author.id === userId ? 'Você' : item.author.fullName;
}

/** Os motivos e a marca do cancelamento pelo sistema, sob a situação (RF19, RN34). */
function Reasons({ item }: { item: MeetingItem }) {
  return (
    <Stack spacing={0.5}>
      {item.situation === 'rejected' && item.rejectionReason && (
        <Typography variant="body2" color="text.secondary">
          Motivo da recusa: {item.rejectionReason}
        </Typography>
      )}
      {item.situation === 'cancelled' && (
        <>
          {item.cancelledBySystem && (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Cancelada pelo sistema
            </Typography>
          )}
          {item.cancellationReason && (
            <Typography variant="body2" color="text.secondary">
              Motivo do cancelamento: {item.cancellationReason}
            </Typography>
          )}
        </>
      )}
    </Stack>
  );
}

export function MeetingsTable({
  items,
  userId,
  renderActions,
}: MeetingListProps) {
  return (
    <TableContainer>
      <Table aria-label="Reuniões">
        <TableHead>
          <TableRow>
            <TableCell>Data e hora</TableCell>
            <TableCell>Com</TableCell>
            <TableCell>Descrição</TableCell>
            <TableCell>Situação</TableCell>
            <TableCell>Solicitada por</TableCell>
            {renderActions && <TableCell>Ações</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>{formatDateTime(item.scheduledAt)}</TableCell>
              <TableCell>{item.counterpart.fullName}</TableCell>
              <TableCell sx={{ maxWidth: 0, width: '30%' }}>
                <TruncatedText text={item.description} />
              </TableCell>
              <TableCell>
                <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                  <SituationChip situation={item.situation} />
                  <Reasons item={item} />
                </Stack>
              </TableCell>
              <TableCell>{requestedBy(item, userId)}</TableCell>
              {renderActions && <TableCell>{renderActions(item)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MeetingCard({
  item,
  userId,
  renderActions,
}: { item: MeetingItem } & Omit<MeetingListProps, 'items'>) {
  const titleId = useId();
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography id={titleId} variant="h6" component="h2" sx={truncated}>
            {item.description}
          </Typography>
          <Typography>{formatDateTime(item.scheduledAt)}</Typography>
          <Typography color="text.secondary">
            {item.counterpart.fullName}
          </Typography>
          <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <SituationChip situation={item.situation} />
            <Reasons item={item} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Solicitada por {requestedBy(item, userId)}
          </Typography>
          {renderActions?.(item)}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function MeetingCards({ items, ...rest }: MeetingListProps) {
  return (
    <Stack spacing={2}>
      {items.map((item) => (
        <MeetingCard key={item.id} item={item} {...rest} />
      ))}
    </Stack>
  );
}
