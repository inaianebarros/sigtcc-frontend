import { Stack, Typography } from '@mui/material';

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
      <Typography variant="h1" component="h1" sx={{ overflowWrap: 'anywhere' }}>
        {fullName}
      </Typography>
      <Typography color="text.secondary">{course}</Typography>
      <Typography variant="body2" color="text.secondary">
        {institute}
      </Typography>
    </Stack>
  );
}
