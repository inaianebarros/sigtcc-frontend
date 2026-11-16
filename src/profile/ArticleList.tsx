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

/** A última palavra do título leva o ícone de nova aba sem quebra: o ícone nunca fica sozinho numa linha. */
function TitleWithIcon({ title }: { title: string }) {
  const words = title.split(' ');
  const last = words.pop() ?? '';
  return (
    <>
      {words.length > 0 && `${words.join(' ')} `}
      <span style={{ whiteSpace: 'nowrap' }}>
        {last}
        <OpenInNew
          aria-hidden
          fontSize="inherit"
          sx={{ ml: 0.5, verticalAlign: 'text-bottom' }}
        />
      </span>
    </>
  );
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
          {/* No celular o ano vem em legenda acima do título; a partir de sm, o título à esquerda e o ano à direita. */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0.5, sm: 2 }}
            sx={{ alignItems: { sm: 'baseline' } }}
          >
            <Typography
              variant="subtitle1"
              component="h3"
              sx={{
                flexGrow: 1,
                minWidth: 0,
                overflowWrap: 'anywhere',
                order: { xs: 1, sm: 0 },
              }}
            >
              {article.url && isWebUrl(article.url) ? (
                <Link
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TitleWithIcon title={article.title} />{' '}
                  <VisuallyHidden>(abre em nova aba)</VisuallyHidden>
                </Link>
              ) : (
                article.title
              )}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ flexShrink: 0, order: { xs: 0, sm: 1 } }}
            >
              {article.year}
            </Typography>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
