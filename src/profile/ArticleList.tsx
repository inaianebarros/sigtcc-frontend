import OpenInNew from '@mui/icons-material/OpenInNew';
import { Card, Link, Stack, Typography } from '@mui/material';
import type { PublishedArticle } from '../services/profileService';

/** Só endereços da web viram link: qualquer outro texto fica como texto. */
function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Os artigos publicados de um perfil só para leitura, em cartões: o título, o ano e, havendo
 * endereço da web, o link "Consultar publicação", que abre em outra aba. `emptyText` é o que a
 * seção diz quando não há artigos.
 */
export function ArticleList({
  articles,
  emptyText = 'Nenhum artigo cadastrado',
}: {
  articles: readonly PublishedArticle[];
  emptyText?: string;
}) {
  if (articles.length === 0) {
    return <Typography color="text.secondary">{emptyText}</Typography>;
  }
  return (
    <Stack
      component="ul"
      aria-label="Artigos publicados"
      spacing={1.5}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {articles.map((article, index) => (
        <Card
          component="li"
          key={`${article.title}-${article.year}-${index}`}
          sx={{ p: 2 }}
        >
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {article.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {article.year}
          </Typography>
          {article.url && isWebUrl(article.url) && (
            <Link
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              aria-label={`Consultar publicação de "${article.title}" (abre em nova aba)`}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 0.5,
              }}
            >
              Consultar publicação
              <OpenInNew aria-hidden fontSize="inherit" />
            </Link>
          )}
        </Card>
      ))}
    </Stack>
  );
}
