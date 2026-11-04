import { createContext } from 'react';

export type FeedbackSeverity = 'error' | 'success' | 'info' | 'warning';

export interface FeedbackContextValue {
  notify: (message: string, severity?: FeedbackSeverity) => void;
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);
