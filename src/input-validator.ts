import type { ValidationResult } from './types.ts';
import { DEFAULT_TIMEOUT_MINUTES } from './types.ts';
import { isInputEmpty } from './template.ts';

// Quick exit reminder message (< timeout minutes)
function getQuickExitMessage(): string {
  return `
To continue the workflow, run ask-me again and enter your response.`;
}

// Timeout reminder message (>= timeout minutes, editor auto-closed)
function getTimeoutReminderMessage(timeoutMinutes: number): string {
  return `
To continue the workflow, the AI agent will call ask-me again.`;
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

  // Empty input - determine which message to show
  if (isTimeout) {
    return {
      isValid: false,
      isEmpty: true,
      isTimeout: true,
      message: getTimeoutReminderMessage(timeoutMinutes),
    };
  }

  return {
    isValid: false,
    isEmpty: true,
    isTimeout: false,
    message: getQuickExitMessage(),
  };
}
