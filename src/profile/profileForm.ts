import { z } from 'zod';
import type {
  PublishedArticle,
  StudentProfile,
  StudentProfileChanges,
} from '../services/profileService';

export interface ArticleRow {
  title: string;
  year: string;
  url: string;
}

export interface ProfileFormValues {
  fullName: string;
  areaIds: number[];
  articles: ArticleRow[];
}

export const MAX_ARTICLES = 50;
const MIN_ARTICLE_YEAR = 1900;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function articleSchema(currentYear: number) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, 'Informe o título do artigo.')
      .max(255, 'O título deve ter no máximo 255 caracteres.'),
    year: z
      .string()
      .trim()
      .refine(
        (value) =>
          /^\d{4}$/.test(value) &&
          Number(value) >= MIN_ARTICLE_YEAR &&
          Number(value) <= currentYear,
        `Informe um ano entre ${MIN_ARTICLE_YEAR} e ${currentYear}.`,
      ),
    url: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || (value.length <= 500 && isHttpUrl(value)),
        'Informe um endereço http ou https de até 500 caracteres.',
      ),
  });
}

export function profileSchema(currentYear = new Date().getFullYear()) {
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Informe o nome completo.')
      .max(150, 'O nome deve ter no máximo 150 caracteres.'),
    areaIds: z
      .array(z.number())
      .min(1, 'Escolha ao menos uma área de interesse.'),
    articles: z
      .array(articleSchema(currentYear))
      .max(MAX_ARTICLES, `Informe no máximo ${MAX_ARTICLES} artigos.`),
  });
}

export function toArticleRow(article: PublishedArticle): ArticleRow {
  return {
    title: article.title,
    year: String(article.year),
    url: article.url,
  };
}

export function toFormValues(profile: StudentProfile): ProfileFormValues {
  return {
    fullName: profile.fullName,
    areaIds: profile.areaIds,
    articles: profile.articles.map(toArticleRow),
  };
}

export type DirtyFields = Partial<
  Record<keyof ProfileFormValues, boolean | object | object[]>
>;

function isDirty(flag: DirtyFields[keyof DirtyFields]): boolean {
  if (Array.isArray(flag)) return flag.some((item) => isDirty(item));
  if (typeof flag === 'object' && flag !== null) {
    return Object.values(flag).some((item) => isDirty(item));
  }
  return flag === true;
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && new Set([...a, ...b]).size === a.length;
}

function sameArticles(a: PublishedArticle[], b: PublishedArticle[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (article, index) =>
        article.title === b[index]?.title &&
        article.year === b[index]?.year &&
        article.url === b[index]?.url,
    )
  );
}

/**
 * Só o que mudou de verdade em relação ao perfil salvo: as listas de áreas e de artigos
 * substituem a lista inteira, então uma mudança que não altera nada (outra ordem das áreas,
 * espaços nas pontas) não deve gerar uma gravação.
 */
export function toChanges(
  values: ProfileFormValues,
  dirtyFields: DirtyFields,
  baseline: StudentProfile,
): StudentProfileChanges {
  const changes: StudentProfileChanges = {};
  const fullName = values.fullName.trim();
  if (isDirty(dirtyFields.fullName) && fullName !== baseline.fullName) {
    changes.fullName = fullName;
  }
  if (
    isDirty(dirtyFields.areaIds) &&
    !sameSet(values.areaIds, baseline.areaIds)
  ) {
    changes.areaIds = values.areaIds;
  }
  if (isDirty(dirtyFields.articles)) {
    const articles = values.articles.map((row) => ({
      title: row.title.trim(),
      year: Number(row.year),
      url: row.url.trim(),
    }));
    if (!sameArticles(articles, baseline.articles)) changes.articles = articles;
  }
  return changes;
}
