import { Alert, Snackbar } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../services/apiError';
import { FeedbackContext } from './feedbackContext';
import type { FeedbackSeverity } from './feedbackContext';

interface FeedbackMessage {
  message: string;
  severity: FeedbackSeverity;
}

const UNEXPECTED_ERROR_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente.';

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<FeedbackMessage | null>(null);

  const notify = useCallback(
    (message: string, severity: FeedbackSeverity = 'info') => {
      setCurrent({ message, severity });
    },
    [],
  );

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      notify(
        reason instanceof ApiError ? reason.message : UNEXPECTED_ERROR_MESSAGE,
        'error',
      );
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [notify]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Snackbar
        open={current !== null}
        autoHideDuration={6000}
        onClose={() => setCurrent(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={current?.severity ?? 'info'}
          variant="filled"
          onClose={() => setCurrent(null)}
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </FeedbackContext.Provider>
  );
}
