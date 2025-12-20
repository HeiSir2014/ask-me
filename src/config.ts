import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { z } from 'zod';
import type { Settings } from './types.ts';
import { DEFAULT_TIMEOUT_MINUTES } from './types.ts';
import { getPreset, getPresetNames } from './editors/presets.ts';

// Config directory path
const CONFIG_DIR_NAME = '.ask-me';
const SETTINGS_FILE_NAME = 'settings.json';

// Settings schema for validation
const SettingsSchema = z.object({
  env: z
    .object({
      EDITOR: z.string().min(1).optional(),
    })
    .optional(),
  editorPreset: z.string().optional(),
  gotoFormat: z.string().optional(),
  timeoutMinutes: z.number().int().min(1).max(60).optional(),
});

// Default settings
const DEFAULT_SETTINGS: Settings = {
  env: { EDITOR: 'code -r -w' },
  editorPreset: 'vscode',
  gotoFormat: '-g {file}:{line}',
  timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
};

// Validate and sanitize settings (internal)
function parseAndValidateSettings(raw: unknown): Partial<Settings> {
  try {
    const parsed = SettingsSchema.parse(raw);

    // Additional validation: check if editorPreset is valid
    if (parsed.editorPreset) {
      const validPresets = getPresetNames();
      if (!validPresets.includes(parsed.editorPreset.toLowerCase())) {
        // Invalid preset, will use default
        parsed.editorPreset = undefined;
      }
    }

    return parsed as Partial<Settings>;
  } catch {
    // Validation failed, return empty object to use defaults
    return {};
  }
}

// Public validation function - returns validation result with errors
export function validateSettings(): { valid: boolean; errors: string[] } {
  const settingsPath = getSettingsPath();
  const errors: string[] = [];

  if (!existsSync(settingsPath)) {
    return { valid: true, errors: [] };
  }

  try {
    const content = readFileSync(settingsPath, 'utf-8');
    const raw = JSON.parse(content);

    // Try to validate with zod
    const result = SettingsSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
      // Reset to defaults
      saveSettings(DEFAULT_SETTINGS);
      return { valid: false, errors };
    }

    // Check preset validity
    if (raw.editorPreset) {
      const validPresets = getPresetNames();
      if (!validPresets.includes(raw.editorPreset.toLowerCase())) {
        errors.push(
          `editorPreset: Invalid preset '${raw.editorPreset}'. Valid: ${validPresets.join(', ')}`
        );
        return { valid: false, errors };
      }
    }

    return { valid: true, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Invalid JSON: ${msg}`);
    // Reset to defaults
    saveSettings(DEFAULT_SETTINGS);
    return { valid: false, errors };
  }
}

// Get config directory path (~/.ask-me/)
export function getConfigDir(): string {
  return join(homedir(), CONFIG_DIR_NAME);
}

// Check if this is the first run (no settings file exists)
export function isFirstRun(): boolean {
  const settingsPath = getSettingsPath();
  return !existsSync(settingsPath);
}

// Ensure config directory exists
export function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Get settings file path
export function getSettingsPath(): string {
  return join(getConfigDir(), SETTINGS_FILE_NAME);
}

// Load settings with defaults
export function loadSettings(): Settings {
  ensureConfigDir();
  const settingsPath = getSettingsPath();

  if (!existsSync(settingsPath)) {
    // Create default settings file
    saveSettings(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const content = readFileSync(settingsPath, 'utf-8');
    const raw = JSON.parse(content);

    // Validate and sanitize settings
    const validated = parseAndValidateSettings(raw);

    // Merge with defaults
    return {
      env: { ...DEFAULT_SETTINGS.env, ...validated.env },
      editorPreset: validated.editorPreset ?? DEFAULT_SETTINGS.editorPreset,
      gotoFormat: validated.gotoFormat ?? DEFAULT_SETTINGS.gotoFormat,
      timeoutMinutes: validated.timeoutMinutes ?? DEFAULT_SETTINGS.timeoutMinutes,
    };
  } catch {
    // If settings file is corrupt (invalid JSON), return defaults
    return { ...DEFAULT_SETTINGS };
  }
}

// Save settings to file
export function saveSettings(settings: Settings): void {
  ensureConfigDir();
  const settingsPath = getSettingsPath();

  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    // Check for permission error
    if (msg.includes('EACCES') || msg.includes('permission')) {
      const configDir = getConfigDir();
      throw new Error(
        `Permission denied writing to ${settingsPath}\n\n` +
          `This usually happens if you previously ran ask-me with sudo.\n` +
          `Fix by changing ownership:\n\n` +
          `  sudo chown -R $(whoami) "${configDir}"\n`
      );
    }

    throw error;
  }
}

// Get current editor configuration
export function getCurrentEditor(): { command: string; gotoFormat: string } {
  const settings = loadSettings();

  // If custom EDITOR is set and no preset, use it
  if (settings.env.EDITOR && !settings.editorPreset) {
    return {
      command: settings.env.EDITOR,
      gotoFormat: settings.gotoFormat ?? DEFAULT_SETTINGS.gotoFormat!,
    };
  }

  // Use preset if available
  if (settings.editorPreset) {
    const preset = getPreset(settings.editorPreset);
    if (preset) {
      return {
        command: preset.command,
        gotoFormat: preset.gotoFormat,
      };
    }
  }

  // Fallback to default
  return {
    command: DEFAULT_SETTINGS.env.EDITOR!,
    gotoFormat: DEFAULT_SETTINGS.gotoFormat!,
  };
}

// Set editor to a preset
export function setEditorPreset(name: string): boolean {
  const preset = getPreset(name);
  if (!preset) {
    return false;
  }

  const settings = loadSettings();
  settings.editorPreset = preset.name;
  settings.gotoFormat = preset.gotoFormat;
  settings.env.EDITOR = preset.command;
  saveSettings(settings);
  return true;
}

// Set custom editor command
export function setCustomEditor(command: string, gotoFormat?: string): void {
  const settings = loadSettings();
  settings.env.EDITOR = command;
  settings.editorPreset = undefined;
  if (gotoFormat) {
    settings.gotoFormat = gotoFormat;
  }
  saveSettings(settings);
}

// Get timeout in minutes
export function getTimeoutMinutes(): number {
  const settings = loadSettings();
  return settings.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
}

// Get files directory for markdown files
export function getFilesDir(): string {
  return getConfigDir();
}
