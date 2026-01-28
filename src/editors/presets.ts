import type { EditorPreset } from '../types.ts';

// All supported editor presets
// CLI flags verified from official --help output:
// -r/--reuse-window: reuse existing window
// -w/--wait: wait for file to be closed
// -g/--goto: open at specific line
// -a/--add: add to workspace
const EDITOR_PRESETS: EditorPreset[] = [
  // VSCode family: code -r -w -g file:line
  {
    name: 'vscode',
    command: 'code -r -w',
    gotoFormat: '-g {file}:{line}',
    description: 'Visual Studio Code (default)',
    platforms: ['win32', 'darwin', 'linux'],
  },
  {
    name: 'cursor',
    command: 'cursor -r -w',
    gotoFormat: '-g {file}:{line}',
    description: 'Cursor AI Editor',
    platforms: ['win32', 'darwin', 'linux'],
  },
  {
    name: 'code-insiders',
    command: 'code-insiders -r -w',
    gotoFormat: '-g {file}:{line}',
    description: 'VS Code Insiders',
    platforms: ['win32', 'darwin', 'linux'],
  },
  // Zed: zed -r -w file:line (supports -r and -w)
  {
    name: 'zed',
    command: 'zed -r -w',
    gotoFormat: '{file}:{line}',
    description: 'Zed Editor',
    platforms: ['win32', 'darwin', 'linux'],
  },
  // Sublime: subl -w file:line (no -r equivalent)
  {
    name: 'sublime',
    command: 'subl -w',
    gotoFormat: '{file}:{line}',
    description: 'Sublime Text',
    platforms: ['win32', 'darwin', 'linux'],
  },
  // Atom family: atom -w file:line
  {
    name: 'atom',
    command: 'atom -w',
    gotoFormat: '{file}:{line}',
    description: "GitHub's Atom Editor (deprecated)",
    platforms: ['win32', 'darwin', 'linux'],
  },
  {
    name: 'pulsar',
    command: 'pulsar -w',
    gotoFormat: '{file}:{line}',
    description: 'Pulsar (Atom fork)',
    platforms: ['win32', 'darwin', 'linux'],
  },
  // TextMate: mate -w -l line file
  {
    name: 'textmate',
    command: 'mate -w',
    gotoFormat: '-l {line} {file}',
    description: 'TextMate (macOS)',
    platforms: ['darwin'],
  },
  // Notepad++: notepad++ -nLINE file (no wait flag)
  {
    name: 'notepad++',
    command: 'notepad++',
    gotoFormat: '-n{line} {file}',
    description: 'Notepad++ (Windows, no wait)',
    platforms: ['win32'],
  },
  // Terminal editors: vim/nvim/emacs/nano +line file
  {
    name: 'vim',
    command: 'vim',
    gotoFormat: '+{line} {file}',
    description: 'Vim (terminal)',
    platforms: ['win32', 'darwin', 'linux'],
  },
  {
    name: 'nvim',
    command: 'nvim',
    gotoFormat: '+{line} {file}',
    description: 'Neovim (terminal)',
    platforms: ['win32', 'darwin', 'linux'],
  },
  {
    name: 'emacs',
    command: 'emacs',
    gotoFormat: '+{line} {file}',
    description: 'GNU Emacs',
    platforms: ['win32', 'darwin', 'linux'],
  },
  {
    name: 'nano',
    command: 'nano',
    gotoFormat: '+{line} {file}',
    description: 'GNU Nano (terminal)',
    platforms: ['darwin', 'linux'],
  },
  // Modern editors: file:line format
  {
    name: 'helix',
    command: 'hx',
    gotoFormat: '{file}:{line}',
    description: 'Helix (terminal)',
    platforms: ['win32', 'darwin', 'linux'],
  },
  {
    name: 'fleet',
    command: 'fleet',
    gotoFormat: '{file}:{line}',
    description: 'JetBrains Fleet',
    platforms: ['win32', 'darwin', 'linux'],
  },
  {
    name: 'lapce',
    command: 'lapce',
    gotoFormat: '{file}:{line}',
    description: 'Lapce Editor',
    platforms: ['win32', 'darwin', 'linux'],
  },
];

// Get preset by name
export function getPreset(name: string): EditorPreset | undefined {
  return EDITOR_PRESETS.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

// Get all presets
export function getAllPresets(): EditorPreset[] {
  return [...EDITOR_PRESETS];
}

// Get all preset names
export function getPresetNames(): string[] {
  return EDITOR_PRESETS.map((p) => p.name);
}

// Format goto command arguments based on preset format
export function formatGotoCommand(gotoFormat: string, file: string, line: number): string[] {
  const formatted = gotoFormat.replace('{file}', file).replace('{line}', String(line));

  // Split by space but handle cases like "-g file:line"
  return formatted.split(/\s+/).filter((s) => s.length > 0);
}

// Build full editor command with goto line
export function buildEditorCommand(
  command: string,
  gotoFormat: string,
  file: string,
  line: number
): string[] {
  const baseArgs = command.split(/\s+/).filter((s) => s.length > 0);
  const gotoArgs = formatGotoCommand(gotoFormat, file, line);
  return [...baseArgs, ...gotoArgs];
}

// Editor detection priority (most suitable for ask-me first)
const EDITOR_PRIORITY = [
  'cursor', // AI-optimized, best for ask-me
  'code', // Most popular
  'zed', // Modern, fast
  'subl', // Classic
  'nvim', // Terminal power users
  'vim', // Classic terminal
];

// Check if a command is available in PATH
export async function isCommandAvailable(cmd: string): Promise<boolean> {
  try {
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    const proc = Bun.spawn([checkCmd, cmd], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

// Check if an editor preset is installed
export async function isEditorInstalled(preset: EditorPreset): Promise<boolean> {
  const cmd = preset.command.split(/\s+/)[0];
  if (!cmd) return false;
  return isCommandAvailable(cmd);
}

// Auto-detect the best available editor
export async function detectBestEditor(): Promise<string | null> {
  for (const editorCmd of EDITOR_PRIORITY) {
    // Find preset that uses this command
    const preset = EDITOR_PRESETS.find((p) => p.command.split(/\s+/)[0] === editorCmd);
    if (preset && (await isCommandAvailable(editorCmd))) {
      return preset.name;
    }
  }
  return null;
}
