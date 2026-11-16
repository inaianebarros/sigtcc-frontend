import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
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
    <FormControl error={Boolean(errors.isAvailable)}>
      <Controller
        name="isAvailable"
        control={control}
        render={({ field }) => (
          <RadioGroup
            row
            name={field.name}
            aria-label="Disponibilidade para orientação"
            value={field.value ? 'available' : 'unavailable'}
            onChange={(event) =>
              field.onChange(event.target.value === 'available')
            }
            onBlur={field.onBlur}
          >
            <FormControlLabel
              value="available"
              label="Disponível"
              control={<Radio slotProps={{ input: { ref: field.ref } }} />}
            />
            <FormControlLabel
              value="unavailable"
              label="Indisponível"
              control={<Radio />}
            />
          </RadioGroup>
        )}
      />
      {errors.isAvailable && (
        <FormHelperText>{errors.isAvailable.message}</FormHelperText>
      )}
      <Typography variant="body2" color="text.secondary">
        Ficar indisponível ou retirar um curso não afeta as orientações ativas
        nem as solicitações pendentes: só impede que novos alunos solicitem
        orientação.
      </Typography>
    </FormControl>
  );
}
