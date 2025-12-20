// Settings stored in ~/.ask-me/settings.json
export interface Settings {
  env: { EDITOR?: string };
  editorPreset?: string;
  gotoFormat?: string;
  timeoutMinutes?: number; // Default: 4
}

// CLI options for main command
export interface CLIOptions {
  cwd: string;
  title: string;
  context?: string;
}

// Editor preset configuration
export interface EditorPreset {
  name: string;
  command: string;
  gotoFormat: string;
  description: string;
  platforms: string[];
}

// Editor subcommand types
export interface EditorCommand {
  subcommand: 'list' | 'current' | 'use' | 'set';
  value?: string;
}

// Init command (install Cursor rules)
export interface InitCommand {
  targetDir: string; // PWD where .cursor/rules/ will be created
}

// Install command (install CLI to system PATH)
export interface InstallCommand {
  // No params needed - uses process.execPath
}

// History command options
export interface HistoryCommand {
  project?: string; // Specific project to show
  limit?: number; // Max sessions to show
}

// Pause command
export interface PauseCommand {
  targetDir: string; // PWD where .cursor/pause will be created
}

// CLI command union type
export type CLICommand =
  | { type: 'main'; options: CLIOptions }
  | { type: 'editor'; command: EditorCommand }
  | { type: 'init'; command: InitCommand }
  | { type: 'install' }
  | { type: 'history'; command: HistoryCommand }
  | { type: 'pause'; command: PauseCommand }
  | { type: 'resume'; command: PauseCommand }
  | { type: 'config' };

// Result from editor spawn
export interface EditorResult {
  duration: number; // milliseconds
  userInput: string;
  isEmpty: boolean;
}

// Input validation result
export interface ValidationResult {
  isValid: boolean;
  isEmpty: boolean;
  isTimeout: boolean;
  message?: string; // Reminder message to print (if empty input)
}

// Install command result
export interface InstallResult {
  success: boolean;
  installedPath: string;
  message: string;
}

// All exits use code 0 (required for Cursor integration)
export const EXIT_CODE = 0;

// Default timeout in minutes
export const DEFAULT_TIMEOUT_MINUTES = 4;
