import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedbackProvider } from './contexts/FeedbackProvider';
import { SessionProvider } from './contexts/SessionProvider';
import { AppRoutes } from './routes';

const theme = createTheme();

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <FeedbackProvider>
          <SessionProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </SessionProvider>
        </FeedbackProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
