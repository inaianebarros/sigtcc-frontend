import {
  Box,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { NavLink } from 'react-router-dom';
import type { NavigationItem } from '../navigation/areas';

export const DRAWER_WIDTH = 240;

interface SideMenuProps {
  items: readonly NavigationItem[];
  hasActiveAdvising: boolean;
  variant?: 'permanent' | 'temporary';
  open?: boolean;
  onClose?: () => void;
}

function MenuItem({
  item,
  hasActiveAdvising,
  onNavigate,
}: {
  item: NavigationItem;
  hasActiveAdvising: boolean;
  onNavigate?: () => void;
}) {
  if (item.requiresActiveAdvising && !hasActiveAdvising) {
    // O estado "disabled" do MUI aplica opacidade 0,38 e derrubaria o contraste do motivo
    // (RNF23). Por isso o item fica focável, com aria-disabled e o motivo sempre visível.
    return (
      <ListItemButton
        aria-disabled="true"
        onClick={(event) => event.preventDefault()}
        sx={{
          cursor: 'not-allowed',
          color: 'text.secondary',
          '&:hover': { backgroundColor: 'transparent' },
        }}
      >
        <ListItemText
          primary={item.label}
          secondary={item.requiresActiveAdvising.reason}
        />
      </ListItemButton>
    );
  }
  return (
    <ListItemButton
      component={NavLink}
      to={item.path}
      onClick={onNavigate}
      sx={{
        '&.active': { backgroundColor: 'action.selected' },
      }}
    >
      <ListItemText primary={item.label} />
    </ListItemButton>
  );
}

export function SideMenu({
  items,
  hasActiveAdvising,
  variant = 'permanent',
  open = true,
  onClose,
}: SideMenuProps) {
  const temporary = variant === 'temporary';
  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: temporary ? undefined : DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          position: temporary ? 'fixed' : 'relative',
        },
      }}
    >
      {temporary && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <Button onClick={onClose}>Fechar menu</Button>
        </Box>
      )}
      <nav id="menu-principal" aria-label="Menu principal">
        <List>
          {items.map((item) => (
            <ListItem key={item.path} disablePadding>
              <MenuItem
                item={item}
                hasActiveAdvising={hasActiveAdvising}
                onNavigate={onClose}
              />
            </ListItem>
          ))}
        </List>
      </nav>
    </Drawer>
  );
}
