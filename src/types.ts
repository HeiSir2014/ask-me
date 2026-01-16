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
  hooksScope?: 'project' | 'user' | 'none';
  skipHooks?: boolean;
}

// Hooks command
export interface HooksCommand {
  status?: boolean; // 用户手动检查状态
}

// Hook context from Cursor
export interface HookContext {
  // 通用字段（所有 hooks 都会接收）
  conversation_id: string;
  generation_id: string;
  model: string;
  hook_event_name: string;
  cursor_version: string;
  workspace_roots: string[];
  user_email: string | null;

  // beforeShellExecution 特有
  command?: string;
  cwd?: string;

  // beforeMCPExecution 特有
  tool_name?: string;
  tool_input?: string;
  url?: string;

  // beforeReadFile 特有
  file_path?: string;
  attachments?: Array<{
    type: 'file' | 'rule';
    filePath: string;
  }>;

  // afterShellExecution 特有
  output?: string;
  duration?: number;

  // afterMCPExecution 特有
  result_json?: string;

  // afterFileEdit / afterTabFileEdit 特有
  edits?: Array<{
    old_string: string;
    new_string: string;
    // afterTabFileEdit 额外字段
    range?: {
      start_line_number: number;
      start_column: number;
      end_line_number: number;
      end_column: number;
    };
    old_line?: string;
    new_line?: string;
  }>;

  // beforeTabFileRead 特有
  content?: string;

  // beforeSubmitPrompt 特有
  prompt?: string;

  // afterAgentResponse / afterAgentThought 特有
  text?: string;
  duration_ms?: number;

  // stop 特有
  status?: 'completed' | 'aborted' | 'error';
  loop_count?: number;
}

// Hook output to Cursor
export interface HookOutput {
  // beforeShellExecution / beforeMCPExecution / beforeReadFile 输出
  permission?: 'allow' | 'deny' | 'ask';
  user_message?: string;
  agent_message?: string;

  // beforeSubmitPrompt 输出
  continue?: boolean;

  // stop 输出
  followup_message?: string;
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
  targetDir: string; // PWD where .cursor/.pause-signal will be created
}

// Mute command (global, affects all projects)
export interface MuteCommand {
  status?: boolean; // Show status only
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
  | { type: 'mute'; command: MuteCommand }
  | { type: 'unmute' }
  | { type: 'hooks'; command: HooksCommand }
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
