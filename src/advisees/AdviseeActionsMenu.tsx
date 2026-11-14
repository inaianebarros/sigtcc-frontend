import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { IconButton, ListItemText, Menu, MenuItem } from '@mui/material';
import { useId, useState } from 'react';

interface AdviseeActionsMenuProps {
  studentName: string;
  /** Escolher "Encerrar orientação": quem usa abre o diálogo de confirmação com o motivo (RN33). */
  onEnd: () => void;
}

/**
 * O menu "⋯" do cartão do orientando (RF33). A ação destrutiva fica aqui, fora das ações do dia a
 * dia: o único item é "Encerrar orientação", em vermelho, e ele só abre a confirmação (RNF21).
 */
export function AdviseeActionsMenu({
  studentName,
  onEnd,
}: AdviseeActionsMenuProps) {
  const buttonId = useId();
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  return (
    <>
      <IconButton
        id={buttonId}
        aria-label={`Mais ações de ${studentName}`}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        edge="end"
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { 'aria-labelledby': buttonId } }}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEnd();
          }}
          sx={{ color: 'error.dark' }}
        >
          <ListItemText>Encerrar orientação</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
