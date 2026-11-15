import { Box, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type { ReactNode } from 'react';

interface ProfileSectionProps {
  /** Dá à seção um endereço fixo (`#tema`); sem ele o `id` é gerado. */
  id?: string;
  title: string;
  description?: string;
  /** Um resumo ou controle à direita do título, como a contagem de artigos. */
  aside?: ReactNode;
  children: ReactNode;
}

/** Uma seção da tela de perfil: título, frase de apoio e conteúdo, ligados para o leitor de tela. */
export function ProfileSection({
  id,
  title,
  description,
  aside,
  children,
}: ProfileSectionProps) {
  const generated = useId();
  const sectionId = id ?? generated;
  const titleId = `${sectionId}-title`;
  return (
    <Box component="section" id={sectionId} aria-labelledby={titleId}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <Box>
            {/* tabIndex -1: o link do Dashboard leva o foco ao título da seção. */}
            <Typography
              variant="h3"
              component="h2"
              id={titleId}
              tabIndex={-1}
              sx={{ outline: 'none' }}
            >
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
          {aside}
        </Stack>
        {children}
      </Stack>
    </Box>
  );
}
