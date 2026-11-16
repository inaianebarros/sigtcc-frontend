import { Stack, Typography } from '@mui/material';
import { READ_TITLE_SX } from './readTitle';

/** O nome do aluno, com o curso e o instituto abaixo. Sem avatar e sem e-mail nem matrícula (RN32). */
export function StudentProfileHeader({
  fullName,
  course,
  institute,
}: {
  fullName: string;
  course: string;
  institute: string;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="h1" sx={READ_TITLE_SX}>
        {fullName}
      </Typography>
      <Typography variant="subtitle1">{course}</Typography>
      <Typography variant="body2" color="text.secondary">
        {institute}
      </Typography>
    </Stack>
  );
}
