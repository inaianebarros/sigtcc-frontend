import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { render } from '@testing-library/react';
import { Fragment, StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from '../contexts/FeedbackProvider';
import { SessionProvider } from '../contexts/SessionProvider';
import { AppRoutes } from '../routes';
import { LocationProbe } from './LocationProbe';

export function renderApp(path: string, { strict = false } = {}) {
  const Mode = strict ? StrictMode : Fragment;
  return render(
    <Mode>
      <ThemeProvider theme={createTheme()}>
        <CssBaseline />
        <FeedbackProvider>
          <SessionProvider>
            <MemoryRouter initialEntries={[path]}>
              <LocationProbe />
              <AppRoutes />
            </MemoryRouter>
          </SessionProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </Mode>,
  );
}
