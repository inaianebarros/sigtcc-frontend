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
  Typography,
} from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatDeadline } from '../formatters/dateTime';
import type { ActivityItem } from '../services/activityService';
import { StatusWithBadge } from './StatusWithBadge';

interface ActivityListProps {
  items: ActivityItem[];
  /** A coluna e a linha do aluno só existem para o professor. */
  showStudent: boolean;
  /** O título da atividade como link para o detalhe, com a origem da lista. */
  renderTitle: (item: ActivityItem) => ReactNode;
}

export function ActivitiesTable({
  items,
  showStudent,
  renderTitle,
}: ActivityListProps) {
  return (
    <TableContainer>
      <Table aria-label="Atividades">
        <TableHead>
          <TableRow>
            <TableCell>Título</TableCell>
            {showStudent && <TableCell>Aluno</TableCell>}
            <TableCell>Prazo</TableCell>
            <TableCell>Situação</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell component="th" scope="row">
                {renderTitle(item)}
              </TableCell>
              {showStudent && <TableCell>{item.student.fullName}</TableCell>}
              <TableCell>{formatDeadline(item.deadline)}</TableCell>
              <TableCell>
                <StatusWithBadge status={item.status} overdue={item.overdue} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ActivityCard({
  item,
  showStudent,
  renderTitle,
}: { item: ActivityItem } & Omit<ActivityListProps, 'items'>) {
  const titleId = useId();
  return (
    <Card component="article" aria-labelledby={titleId} variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography id={titleId} variant="h6" component="h2">
            {renderTitle(item)}
          </Typography>
          {showStudent && (
            <Typography color="text.secondary">
              {item.student.fullName}
            </Typography>
          )}
          <Typography>Prazo: {formatDeadline(item.deadline)}</Typography>
          <StatusWithBadge status={item.status} overdue={item.overdue} />
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ActivityCards({ items, ...rest }: ActivityListProps) {
  return (
    <Stack spacing={2}>
      {items.map((item) => (
        <ActivityCard key={item.id} item={item} {...rest} />
      ))}
    </Stack>
  );
}
