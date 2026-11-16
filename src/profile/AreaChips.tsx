import Done from '@mui/icons-material/Done';
import { Chip, Stack } from '@mui/material';
import { useId } from 'react';
import { VisuallyHidden } from '../components/VisuallyHidden';
export interface ProfileArea {
  id: number;
  name: string;
  isCommon: boolean;
}

/**
 * As áreas de interesse de um perfil só para leitura, o do professor visto pelo aluno e o do aluno
 * visto pelo professor, as em comum primeiro (RN23): as em comum em verde, preenchidas, maiores e
 * em negrito, as outras neutras e só com contorno. O leitor de tela ouve "em comum" junto do nome,
 * porque a cor sozinha não basta (WCAG 1.4.1). `labelledBy` aponta para o título da seção. Com
 * `announceCount`, a lista também anuncia quantas são em comum, sem texto à vista.
 */
export function AreaChips({
  areas,
  labelledBy,
  announceCount = false,
}: {
  areas: readonly ProfileArea[];
  labelledBy: string;
  announceCount?: boolean;
}) {
  const descriptionId = useId();
  const commonCount = areas.filter((area) => area.isCommon).length;
  return (
    <Stack
      component="ul"
      aria-labelledby={labelledBy}
      aria-describedby={announceCount ? descriptionId : undefined}
      direction="row"
      useFlexGap
      sx={{ flexWrap: 'wrap', gap: 1, m: 0, p: 0, listStyle: 'none' }}
    >
      {announceCount && (
        <VisuallyHidden id={descriptionId}>
          {commonCount === 0
            ? 'Nenhuma área em comum'
            : `${commonCount} ${commonCount === 1 ? 'área' : 'áreas'} em comum`}
        </VisuallyHidden>
      )}
      {areas.map((area) => (
        <li key={area.id}>
          <Chip
            size={area.isCommon ? 'medium' : 'small'}
            color={area.isCommon ? 'success' : 'default'}
            variant={area.isCommon ? 'filled' : 'outlined'}
            // Além da cor: um sinal de certo nas em comum e uma borda firme nas outras.
            icon={area.isCommon ? <Done aria-hidden /> : undefined}
            sx={
              area.isCommon ? { fontWeight: 600 } : { borderColor: '#76766a' }
            }
            label={
              <>
                {area.name}
                {area.isCommon && <VisuallyHidden>, em comum</VisuallyHidden>}
              </>
            }
          />
        </li>
      ))}
    </Stack>
  );
}
