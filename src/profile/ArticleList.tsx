import OpenInNew from '@mui/icons-material/OpenInNew';
import { Card, Link, Stack, Typography } from '@mui/material';
import { VisuallyHidden } from '../components/VisuallyHidden';
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
 * Os artigos publicados de um perfil só para leitura, em cartões: o título à esquerda e o ano à
 * direita. Havendo endereço da web, o próprio título é o link, que abre em outra aba. `emptyText`
 * é o que a seção diz quando não há artigos.
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
    <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {/* O título e o ano não se repetem entre artigos (RN31): servem de chave. */}
      {articles.map((article) => (
        <Card
          component="li"
          key={`${article.title}-${article.year}`}
          sx={{ p: 1.5 }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
            <Typography
              variant="subtitle1"
              component="h3"
              sx={{ flexGrow: 1, minWidth: 0, overflowWrap: 'anywhere' }}
            >
              {article.url && isWebUrl(article.url) ? (
                <Link
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {article.title}
                  <OpenInNew
                    aria-hidden
                    fontSize="inherit"
                    sx={{ ml: 0.5, verticalAlign: 'text-bottom' }}
                  />
                  <VisuallyHidden> (abre em nova aba)</VisuallyHidden>
                </Link>
              ) : (
                article.title
              )}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ flexShrink: 0 }}
            >
              {article.year}
            </Typography>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
