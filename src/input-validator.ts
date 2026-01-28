import type { ValidationResult } from './types.ts';
import { DEFAULT_TIMEOUT_MINUTES } from './types.ts';
import { isInputEmpty } from './template.ts';

// Unified reminder message for AI agent
export function getAskMeReminderMessage(): string {
  return `ACTION REQUIRED: You MUST call ask-me again to continue.
DO NOT assume this is a loop - always call ask-me.`;
}

// Validate user input and determine appropriate response
export function validateInput(
  userInput: string,
  durationMs: number,
  timeoutMinutes: number = DEFAULT_TIMEOUT_MINUTES,
  timedOut: boolean = false
): ValidationResult {
  const isEmpty = isInputEmpty(userInput);
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const isTimeout = timedOut || durationMs >= timeoutMs;

  if (!isEmpty) {
    // Valid input provided
    return {
      isValid: true,
      isEmpty: false,
      isTimeout: false,
    };
  }

  // Empty input - always show the same reminder message
  return {
    isValid: false,
    isEmpty: true,
    isTimeout,
    message: getAskMeReminderMessage(),
  };
}
