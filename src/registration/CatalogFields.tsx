import { Autocomplete, MenuItem, TextField } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import type { Catalog } from './useCatalog';
import type { AccountForm } from './accountForm';

/** O campo de áreas serve a qualquer formulário que guarde os ids em `areaIds`. */
export interface AreasFormValues {
  areaIds: number[];
}

interface InstituteFieldProps {
  institutes: Catalog['institutes'];
  onChange: () => void;
}

export function InstituteField({ institutes, onChange }: InstituteFieldProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<AccountForm>();
  const options = institutes.status === 'ready' ? institutes.data : [];
  const hint =
    institutes.status === 'ready' && options.length === 0
      ? 'Nenhum instituto cadastrado.'
      : undefined;

  return (
    <Controller
      name="instituteId"
      control={control}
      render={({ field }) => (
        <TextField
          select
          label="Instituto"
          value={field.value}
          onChange={(event) => {
            field.onChange(event);
            onChange();
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          disabled={institutes.status !== 'ready'}
          error={Boolean(errors.instituteId)}
          helperText={errors.instituteId?.message ?? hint}
        >
          {options.map((institute) => (
            <MenuItem key={institute.id} value={String(institute.id)}>
              {institute.name}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

interface AreasFieldProps {
  areas: Catalog['areas'];
}

export function AreasField({ areas }: AreasFieldProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<AreasFormValues>();
  const options = areas.status === 'ready' ? areas.data : [];
  const hint =
    areas.status === 'ready' && options.length === 0
      ? 'Nenhuma área de interesse cadastrada.'
      : undefined;

  return (
    <Controller
      name="areaIds"
      control={control}
      render={({ field }) => (
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={options}
          getOptionLabel={(area) => area.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={options.filter((area) => field.value.includes(area.id))}
          onChange={(_, selected) =>
            field.onChange(selected.map((area) => area.id))
          }
          onBlur={field.onBlur}
          disabled={areas.status !== 'ready'}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Áreas de interesse"
              inputRef={field.ref}
              error={Boolean(errors.areaIds)}
              helperText={errors.areaIds?.message ?? hint}
            />
          )}
        />
      )}
    />
  );
}
