import { Alert, Autocomplete, Button, TextField } from '@mui/material';
import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useLoad } from '../hooks/useLoad';
import { courseListHint } from '../registration/useCatalog';
import { listCourses } from '../services/catalogService';
import type { TeacherFormValues } from './teacherForm';

/** Os cursos do instituto do professor, em seleção múltipla. */
export function CoursesField({ instituteId }: { instituteId: number }) {
  const {
    control,
    formState: { errors },
  } = useFormContext<Pick<TeacherFormValues, 'courseIds'>>();
  const [attempt, setAttempt] = useState(0);
  const courses = useLoad(
    () => listCourses(instituteId),
    `${instituteId}-${attempt}`,
  );
  const options = courses.status === 'ready' ? courses.data : [];

  // Sem a lista não dá para mostrar os cursos do professor: um campo vazio pareceria "sem cursos".
  if (courses.status === 'error') {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            aria-label="Tentar carregar os cursos de novo"
            onClick={() => setAttempt((current) => current + 1)}
          >
            Tentar de novo
          </Button>
        }
      >
        Não foi possível carregar os cursos.
      </Alert>
    );
  }

  return (
    <Controller
      name="courseIds"
      control={control}
      render={({ field }) => (
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={options}
          getOptionLabel={(course) => course.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={options.filter((course) => field.value.includes(course.id))}
          onChange={(_, selected) => {
            // Um curso gravado que a lista do instituto não traz continua no perfil.
            const hidden = field.value.filter(
              (id) => !options.some((course) => course.id === id),
            );
            field.onChange([...hidden, ...selected.map((course) => course.id)]);
          }}
          onBlur={field.onBlur}
          disabled={courses.status !== 'ready'}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Cursos"
              inputRef={field.ref}
              error={Boolean(errors.courseIds)}
              helperText={errors.courseIds?.message ?? courseListHint(courses)}
            />
          )}
        />
      )}
    />
  );
}
