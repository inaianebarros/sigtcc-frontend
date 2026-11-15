import { CssBaseline, ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';
import { Fragment, StrictMode } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from '../contexts/FeedbackProvider';
import { SessionProvider } from '../contexts/SessionProvider';
import { AppRoutes } from '../routes';
import { LocationProbe } from './LocationProbe';
import { theme } from '../theme';

export function renderApp(
  path: string,
  {
    strict = false,
    entries,
  }: {
    strict?: boolean;
    entries?: (
      string | { pathname: string; search?: string; state?: unknown }
    )[];
  } = {},
) {
  const Mode = strict ? StrictMode : Fragment;
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <LocationProbe />
            <AppRoutes />
          </>
        ),
      },
    ],
    entries
      ? { initialEntries: entries, initialIndex: entries.length - 1 }
      : { initialEntries: [path] },
  );
  const utils = render(
    <Mode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <FeedbackProvider>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </Mode>,
  );
  return { ...utils, router };
}
