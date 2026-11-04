import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="span">
            SIGTCC
          </Typography>
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
