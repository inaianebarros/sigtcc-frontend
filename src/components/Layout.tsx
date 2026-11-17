import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { NotificationsProvider } from '../contexts/NotificationsProvider';
import { NotificationBell } from '../notifications/NotificationBell';
import { SideMenu } from './SideMenu';
import { useSession } from '../hooks/useSession';
import { hasActiveAdvisingOf } from '../navigation/advisingState';
import { areas } from '../navigation/areas';
import { paths } from '../navigation/paths';

export function Layout() {
  const { status, user, signOut } = useSession();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(useTheme().breakpoints.up('md'));
  const [menuOpen, setMenuOpen] = useState(false);
  // O menu aberto não sobrevive ao fim da sessão nem à ida para a tela larga (ajuste durante a
  // renderização, a forma recomendada pelo React no lugar de um efeito).
  const menuAllowed = status === 'authenticated' && !isDesktop;
  if (menuOpen && !menuAllowed) setMenuOpen(false);
  const menuItems =
    status === 'authenticated' && user
      ? (areas.find((area) => area.userType === user.type)?.items ?? [])
      : [];

  const handleSignOut = async () => {
    await signOut();
    navigate(paths.login, { replace: true });
  };

  return (
    <NotificationsProvider>
      {/* A casca tem a altura da janela e quem rola é só a área principal: a barra superior ocupa
          toda a largura e a barra de rolagem começa abaixo dela, em vez de correr ao lado do cabeçalho.
          A barra e o menu ficam sempre à vista porque estão fora da área que rola. */}
      <Box
        sx={{
          height: '100vh',
          '@supports (height: 100dvh)': { height: '100dvh' },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <AppBar position="static">
          <Toolbar sx={{ gap: 2 }}>
            {menuItems.length > 0 && !isDesktop && (
              <Button
                color="inherit"
                aria-label="Abrir menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                Menu
              </Button>
            )}
            <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
              SIGTCC
            </Typography>
            {status === 'authenticated' && user && (
              <>
                {user.type !== 'admin' && <NotificationBell />}
                <Typography component="span">{user.fullName}</Typography>
                <Button color="inherit" onClick={handleSignOut}>
                  Sair
                </Button>
              </>
            )}
          </Toolbar>
        </AppBar>
        <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
          {menuItems.length > 0 && (
            <SideMenu
              items={menuItems}
              hasActiveAdvising={user ? hasActiveAdvisingOf(user) : false}
              variant={isDesktop ? 'permanent' : 'temporary'}
              open={isDesktop || menuOpen}
              onClose={() => setMenuOpen(false)}
            />
          )}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              minWidth: 0,
              overflowY: 'auto',
              // O foco que o teclado leva a um campo não pode parar escondido atrás da barra de salvar.
              scrollPaddingBottom: 'var(--save-bar-clearance, 0px)',
            }}
          >
            <Container
              maxWidth="lg"
              sx={{
                py: { xs: 2, md: 4 },
                px: { xs: 2, sm: 3 },
              }}
            >
              <Outlet />
            </Container>
          </Box>
        </Box>
      </Box>
    </NotificationsProvider>
  );
}
