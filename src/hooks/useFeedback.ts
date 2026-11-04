import { useContext } from 'react';
import { FeedbackContext } from '../contexts/feedbackContext';
import type { FeedbackContextValue } from '../contexts/feedbackContext';

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback deve ser usado dentro de FeedbackProvider');
  }
  return context;
}
