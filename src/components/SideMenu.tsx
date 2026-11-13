import {
  Box,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  SvgIcon,
  Toolbar,
} from '@mui/material';
import { Link as RouterLink, useLocation, useMatch } from 'react-router-dom';
import type { NavigationItem } from '../navigation/areas';
import { originPathname } from '../navigation/origin';

export const DRAWER_WIDTH = 240;

/** O cadeado do item bloqueado: decorativo, o motivo em texto é o que diz por que. */
function LockIcon() {
  return (
    <SvgIcon
      data-testid="lock-icon"
      aria-hidden
      fontSize="small"
      viewBox="0 0 24 24"
    >
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
    </SvgIcon>
  );
}

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
  const location = useLocation();
  const onItemPath = useMatch({ path: item.path, end: false }) !== null;
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
          slotProps={{ secondary: { variant: 'caption' } }}
        />
        <ListItemIcon sx={{ minWidth: 0, ml: 1, color: 'text.secondary' }}>
          <LockIcon />
        </ListItemIcon>
      </ListItemButton>
    );
  }
  // Uma tela aberta a partir de uma lista, como o perfil de um aluno, mantém selecionado o item da
  // lista de onde veio.
  const selected = onItemPath || originPathname(location.state) === item.path;
  return (
    <ListItemButton
      component={RouterLink}
      to={item.path}
      onClick={onNavigate}
      aria-current={selected ? 'page' : undefined}
      className={selected ? 'active' : undefined}
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
          // Fixo nos dois casos: o menu acompanha a rolagem da página.
          position: 'fixed',
        },
      }}
    >
      {/* No desktop o menu fica abaixo da barra superior, que é fixa e cobre o topo dele. */}
      {!temporary && <Toolbar />}
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
