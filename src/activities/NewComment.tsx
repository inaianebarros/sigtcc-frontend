import { useState } from 'react';
import { useStateChangedNotice } from '../hooks/useStateChangedNotice';
import { ApiError, messageOf } from '../services/apiError';
import { addComment } from '../services/commentService';
import { CommentForm } from './CommentForm';
import { commentSchema } from './commentSchema';

interface NewCommentProps {
  activityId: number;
  /** A atividade está concluída: o campo não aceita comentário (RN15). */
  completed: boolean;
  /** O texto digitado e ainda não enviado vive na tela, que o guarda quando o detalhe recarrega. */
  text: string;
  onTextChange: (text: string) => void;
  /** O comentário foi gravado: quem usa relê a linha do tempo, onde ele aparece no topo. */
  onSent: () => void;
}

/** O campo de novo comentário (RF32): envia, limpa o texto e trata os erros do servidor. */
export function NewComment({
  activityId,
  completed,
  text,
  onTextChange,
  onSent,
}: NewCommentProps) {
  const notifyStateChanged = useStateChangedNotice();
  const [sending, setSending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [closedByServer, setClosedByServer] = useState(false);

  const send = async () => {
    setSending(true);
    setFieldError(null);
    setNotice(null);
    try {
      await addComment(activityId, commentSchema.parse(text));
      onTextChange('');
      onSent();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setClosedByServer(true);
        setNotice(error.message);
      } else if (error instanceof ApiError && error.status === 404) {
        // A orientação encerrou: o texto digitado continua à vista.
        notifyStateChanged(error);
      } else if (error instanceof ApiError && error.fieldErrors.text) {
        setFieldError(error.fieldErrors.text);
      } else {
        setFieldError(messageOf(error));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <CommentForm
      text={text}
      onTextChange={onTextChange}
      closed={completed || closedByServer}
      sending={sending}
      error={fieldError}
      notice={notice}
      onSubmit={() => void send()}
    />
  );
}
