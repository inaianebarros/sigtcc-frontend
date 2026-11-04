import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { paths } from '../navigation/paths';

export function Layout() {
  const { status, user, signOut } = useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate(paths.login, { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
            SIGTCC
          </Typography>
          {status === 'authenticated' && user && (
            <>
              <Typography component="span">{user.fullName}</Typography>
              <Button color="inherit" onClick={handleSignOut}>
                Sair
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container
        component="main"
        maxWidth="lg"
        sx={{ flexGrow: 1, py: { xs: 2, md: 4 }, px: { xs: 2, sm: 3 } }}
      >
        <Outlet />
      </Container>
    </Box>
  );
}
