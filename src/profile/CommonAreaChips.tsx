import Done from '@mui/icons-material/Done';
import { Chip, Stack, Typography } from '@mui/material';
import { VisuallyHidden } from '../components/VisuallyHidden';

export interface ProfileArea {
  id: number;
  name: string;
  isCommon: boolean;
}

function commonText(compatibility: number): string {
  if (compatibility === 0) return 'Nenhuma área em comum';
  return `${compatibility} ${compatibility === 1 ? 'área' : 'áreas'} em comum`;
}

interface CommonAreaChipsProps {
  areas: readonly ProfileArea[];
  /** Quantas áreas são em comum, como o servidor calculou (RN23). */
  compatibility: number;
}

/**
 * As áreas de interesse de um perfil, com as em comum destacadas (RN23): chips preenchidos e com
 * um sinal de certo, contra chips só com contorno. A diferença também vai em texto, para o leitor
 * de tela e para quem não distingue cores (WCAG 2.1 AA).
 */
export function CommonAreaChips({
  areas,
  compatibility,
}: CommonAreaChipsProps) {
  if (areas.length === 0) {
    return <Typography>Nenhuma área de interesse cadastrada.</Typography>;
  }
  return (
    <Stack spacing={1.5}>
      <Typography>{commonText(compatibility)}</Typography>
      <Stack
        component="ul"
        aria-label="Áreas de interesse"
        direction="row"
        useFlexGap
        sx={{ flexWrap: 'wrap', gap: 1, m: 0, p: 0, listStyle: 'none' }}
      >
        {areas.map((area) => (
          <li key={area.id}>
            <Chip
              variant={area.isCommon ? 'filled' : 'outlined'}
              color={area.isCommon ? 'primary' : 'default'}
              icon={area.isCommon ? <Done /> : undefined}
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
    </Stack>
  );
}
