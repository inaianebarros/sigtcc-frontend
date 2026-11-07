import {
  FormControlLabel,
  FormHelperText,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import type { TeacherFormValues } from './teacherForm';

/** A disponibilidade para orientar (RN26): só vale depois de salvar, como o resto do perfil. */
export function AvailabilityField() {
  const {
    control,
    formState: { errors },
  } = useFormContext<Pick<TeacherFormValues, 'isAvailable'>>();
  return (
    <Stack spacing={0.5}>
      <Controller
        name="isAvailable"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            label="Disponível para orientar"
            control={
              <Switch
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
                onBlur={field.onBlur}
                slotProps={{ input: { ref: field.ref } }}
              />
            }
          />
        )}
      />
      {errors.isAvailable && (
        <FormHelperText error>{errors.isAvailable.message}</FormHelperText>
      )}
      <Typography variant="body2" color="text.secondary">
        Desligar a disponibilidade ou retirar um curso não afeta as orientações
        ativas nem as solicitações pendentes: só impede que novos alunos
        solicitem orientação.
      </Typography>
    </Stack>
  );
}
