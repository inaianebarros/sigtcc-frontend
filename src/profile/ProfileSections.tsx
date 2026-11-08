import { Stack, Typography } from '@mui/material';
import type { PublishedArticle } from '../services/profileService';
import { ArticleList } from './ArticleList';
import { CommonAreaChips } from './CommonAreaChips';
import type { ProfileArea } from './CommonAreaChips';

interface ProfileSectionsProps {
  areas: readonly ProfileArea[];
  compatibility: number;
  articles: readonly PublishedArticle[];
}

/** As áreas de interesse, com as em comum destacadas, e os artigos de um perfil só para leitura. */
export function ProfileSections({
  areas,
  compatibility,
  articles,
}: ProfileSectionsProps) {
  return (
    <>
      <Stack spacing={1.5} component="section">
        <Typography variant="h6" component="h2">
          Áreas de interesse
        </Typography>
        <CommonAreaChips areas={areas} compatibility={compatibility} />
      </Stack>
      <Stack spacing={1.5} component="section">
        <Typography variant="h6" component="h2">
          Artigos publicados
        </Typography>
        <ArticleList articles={articles} />
      </Stack>
    </>
  );
}
