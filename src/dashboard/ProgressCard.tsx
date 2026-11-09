import { LinearProgress, Stack, Typography } from '@mui/material';
import { Section } from '../activities/Section';

/** O Progresso Geral (RN36) em barra e percentual; o servidor já o trunca, a tela só o mostra. */
export function ProgressCard({ percent }: { percent: number }) {
  return (
    <Section title="Progresso geral">
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <LinearProgress
          variant="determinate"
          value={percent}
          aria-label="Progresso geral"
          sx={{ flex: 1, height: 10, borderRadius: 5 }}
        />
        <Typography sx={{ fontWeight: 'medium' }}>{percent}%</Typography>
      </Stack>
    </Section>
  );
}
