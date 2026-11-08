import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { useState } from 'react';

interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'label'> {
  label: string;
}

/**
 * O único campo de senha da aplicação (RNF29): tem o controle de exibir e ocultar o valor
 * digitado, um olho que mostra o estado atual, fechado com o valor oculto e aberto com ele à
 * mostra. Todo campo de senha novo deve usá-lo; a regra de lint proíbe `type="password"` fora
 * daqui.
 */
export function PasswordField({
  label,
  slotProps,
  ...props
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
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
              {/* O nome é o mesmo nos dois estados: só o `aria-pressed` diz o estado, e o
                  leitor de tela não repete a informação. */}
              <IconButton
                edge="end"
                aria-label={`Mostrar ${label.toLowerCase()}`}
                aria-pressed={shown}
                // O clique do mouse não tira o cursor do campo; pelo teclado o foco fica no botão.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setShown((current) => !current)}
              >
                {shown ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
