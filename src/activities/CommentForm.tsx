import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { PendingChangesNotice } from '../profile/PendingChangesNotice';
import { COMMENT_MAX, commentSchema } from './commentSchema';

export const CLOSED_MESSAGE = 'Atividade concluída: não é possível comentar';

interface CommentFormProps {
  text: string;
  onTextChange: (text: string) => void;
  /** A atividade foi concluída: o campo fica desabilitado, com o motivo à vista. */
  closed: boolean;
  sending: boolean;
  /** Um erro do servidor no campo ou uma falha geral do envio. */
  error: string | null;
  /** O aviso do servidor que não é do campo, como o do 409. */
  notice: string | null;
  onSubmit: () => void;
}

/**
 * O formulário de um comentário (RF32): de 1 a 1000 caracteres com contador, aviso de texto não
 * enviado no topo (RNF28) e o envio desabilitado enquanto o texto é inválido ou o pedido corre.
 */
export function CommentForm({
  text,
  onTextChange,
  closed,
  sending,
  error,
  notice,
  onSubmit,
}: CommentFormProps) {
  const trimmedLength = text.trim().length;
  const valid = commentSchema.safeParse(text).success;
  const tooLong = trimmedLength > COMMENT_MAX;
  const fieldError = tooLong
    ? commentSchema.safeParse(text).error?.issues[0]?.message
    : error;
  return (
    <Stack
      component="form"
      spacing={1}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !sending && !closed) onSubmit();
      }}
    >
      <PendingChangesNotice
        visible={trimmedLength > 0}
        actionLabel="Comentar"
      />
      {notice && <Alert severity="error">{notice}</Alert>}
      <TextField
        label="Novo comentário"
        multiline
        minRows={3}
        value={text}
        disabled={closed || sending}
        error={Boolean(fieldError)}
        helperText={fieldError ?? undefined}
        onChange={(event) => onTextChange(event.target.value)}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ alignSelf: 'flex-end' }}
      >
        {trimmedLength}/{COMMENT_MAX}
      </Typography>
      {closed ? (
        <Typography color="text.secondary">{CLOSED_MESSAGE}</Typography>
      ) : (
        <Button
          type="submit"
          variant="contained"
          disabled={!valid || sending}
          sx={{ alignSelf: 'flex-start' }}
        >
          {sending ? 'Comentando…' : 'Comentar'}
        </Button>
      )}
    </Stack>
  );
}
