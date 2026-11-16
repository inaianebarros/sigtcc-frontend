import { Typography } from '@mui/material';

/**
 * A contagem à direita do título de uma seção ("1 artigo", "5 artigos"). Sem texto quando é zero:
 * a seção vazia já diz isso por conta própria.
 */
export function SectionCount({
  count,
  singular,
  plural,
}: {
  count: number;
  singular: string;
  plural: string;
}) {
  if (count === 0) return null;
  return (
    <Typography variant="body2" color="text.secondary">
      {count === 1 ? `1 ${singular}` : `${count} ${plural}`}
    </Typography>
  );
}
