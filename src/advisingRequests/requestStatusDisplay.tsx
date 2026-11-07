import { SvgIcon } from '@mui/material';
import type { ReactElement } from 'react';
import type { AdvisingRequestStatus } from '../services/advisorService';

interface StatusDisplay {
  label: string;
  icon: ReactElement;
}

function iconOf(path: string): ReactElement {
  // Decorativo: o rótulo em texto é que diz o status, nunca a cor nem o desenho.
  return (
    <SvgIcon aria-hidden fontSize="small">
      <path d={path} />
    </SvgIcon>
  );
}

const CLOCK =
  'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z';
const CHECK =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
const CROSS =
  'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z';
const HOURGLASS =
  'M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z';

/** O único mapa de status: a tela do Aluno e a do Professor (#82) mostram o mesmo texto e ícone. */
export const REQUEST_STATUS: Record<AdvisingRequestStatus, StatusDisplay> = {
  pending: { label: 'Pendente', icon: iconOf(CLOCK) },
  accepted: { label: 'Aceita', icon: iconOf(CHECK) },
  rejected: { label: 'Recusada', icon: iconOf(CROSS) },
  unanswered: {
    label: 'Não respondida',
    icon: iconOf(HOURGLASS),
  },
};

const UNKNOWN_STATUS: StatusDisplay = {
  label: 'Situação desconhecida',
  icon: iconOf(CLOCK),
};

/** O status vem do servidor como texto: um valor novo não pode derrubar a tela. */
export function statusDisplay(status: string): StatusDisplay {
  return (
    (REQUEST_STATUS as Record<string, StatusDisplay | undefined>)[status] ??
    UNKNOWN_STATUS
  );
}
