import { Button, InputAdornment, TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { useState } from 'react';

interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'label'> {
  label: string;
}

/** Um campo de senha com o controle de mostrar e ocultar o que foi digitado. */
export function PasswordField({
  label,
  slotProps,
  ...props
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const action = shown ? 'Ocultar' : 'Mostrar';
  return (
    <TextField
      {...props}
      label={label}
      type={shown ? 'text' : 'password'}
      slotProps={{
        ...slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Button
                size="small"
                aria-label={`${action} ${label.toLowerCase()}`}
                aria-pressed={shown}
                onClick={() => setShown((current) => !current)}
              >
                {action}
              </Button>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
