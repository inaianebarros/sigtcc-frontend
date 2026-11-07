import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedbackProvider } from './contexts/FeedbackProvider';
import { SessionProvider } from './contexts/SessionProvider';
import { AppRoutes } from './routes';

const theme = createTheme();

// Roteador de dados: o aviso de alterações não salvas (RNF28) usa useBlocker, que só existe nele.
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    ),
  },
]);

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <FeedbackProvider>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </FeedbackProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
