import OpenInNew from '@mui/icons-material/OpenInNew';
import { Link, Stack, Typography } from '@mui/material';
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

/** Os artigos publicados de um perfil, só para leitura. Os que têm endereço abrem em outra aba. */
export function ArticleList({
  articles,
}: {
  articles: readonly PublishedArticle[];
}) {
  if (articles.length === 0) {
    return <Typography>Nenhum artigo cadastrado</Typography>;
  }
  return (
    <Stack
      component="ul"
      aria-label="Artigos publicados"
      spacing={1}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {articles.map((article, index) => (
        <Typography
          component="li"
          key={`${article.title}-${article.year}-${index}`}
        >
          {article.url && isWebUrl(article.url) ? (
            <Link href={article.url} target="_blank" rel="noopener noreferrer">
              {article.title}
              <OpenInNew
                aria-hidden
                fontSize="inherit"
                sx={{ ml: 0.5, verticalAlign: 'text-bottom' }}
              />
              <VisuallyHidden> (abre em uma nova aba)</VisuallyHidden>
            </Link>
          ) : (
            article.title
          )}{' '}
          <Typography component="span" color="text.secondary">
            ({article.year})
          </Typography>
        </Typography>
      ))}
    </Stack>
  );
}
