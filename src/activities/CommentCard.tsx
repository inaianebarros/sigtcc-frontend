import { Chip, Paper, Stack, Typography } from '@mui/material';
import { forwardRef } from 'react';
import { formatDateTime } from '../formatters/dateTime';
import type { ActivityComment } from '../services/commentService';

const TYPE_LABELS = { student: 'Aluno', teacher: 'Professor' } as const;

interface CommentCardProps {
  comment: ActivityComment;
  /** O comentário é do usuário que lê a tela. */
  own: boolean;
}

/**
 * Um comentário: o autor com a etiqueta do tipo em texto (não só em cor), a data e a hora no
 * horário da instituição e o texto puro, com as quebras de linha (RF32).
 */
export const CommentCard = forwardRef<HTMLLIElement, CommentCardProps>(
  function CommentCard({ comment, own }, ref) {
    return (
      <Paper
        component="li"
        ref={ref}
        variant="outlined"
        sx={{ p: 2, listStyle: 'none' }}
      >
        <Stack spacing={1}>
          <Stack
            direction="row"
            useFlexGap
            sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
          >
            <Typography sx={{ fontWeight: 'medium' }}>
              {comment.author.fullName}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={TYPE_LABELS[comment.author.type]}
            />
            {own && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label="Você"
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(comment.createdAt)}
            </Typography>
          </Stack>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {comment.text}
          </Typography>
        </Stack>
      </Paper>
    );
  },
);
