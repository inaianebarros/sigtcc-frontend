import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from '../contexts/FeedbackProvider';
import { SessionProvider } from '../contexts/SessionProvider';
import { AppRoutes } from '../routes';

export function renderApp(path: string) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <CssBaseline />
      <FeedbackProvider>
        <SessionProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </SessionProvider>
      </FeedbackProvider>
    </ThemeProvider>,
  );
}
