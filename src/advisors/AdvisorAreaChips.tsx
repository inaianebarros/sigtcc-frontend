import { Chip, Stack } from '@mui/material';
import { VisuallyHidden } from '../components/VisuallyHidden';
import type { ProfileArea } from '../profile/CommonAreaChips';

/**
 * As áreas de interesse de um professor, as em comum com o aluno primeiro (RN23): as em comum em
 * verde e preenchidas, as outras neutras e só com contorno. O leitor de tela ouve "em comum" junto
 * do nome, porque a cor sozinha não basta (WCAG 1.4.1). `labelledBy` aponta para o título da seção.
 */
export function AdvisorAreaChips({
  areas,
  labelledBy,
}: {
  areas: readonly ProfileArea[];
  labelledBy: string;
}) {
  return (
    <Stack
      component="ul"
      aria-labelledby={labelledBy}
      direction="row"
      useFlexGap
      sx={{ flexWrap: 'wrap', gap: 1, m: 0, p: 0, listStyle: 'none' }}
    >
      {areas.map((area) => (
        <li key={area.id}>
          <Chip
            size="small"
            color={area.isCommon ? 'success' : 'default'}
            variant={area.isCommon ? 'filled' : 'outlined'}
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
