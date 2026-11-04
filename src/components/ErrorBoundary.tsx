import { Alert, Container } from '@mui/material';
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
          <Alert severity="error">
            Ocorreu um erro inesperado. Recarregue a página e tente novamente.
          </Alert>
        </Container>
      );
    }
    return this.props.children;
  }
}
