import chalk from 'chalk';
import { getConfigDir, getSettingsPath, isFirstRun, saveSettings } from './config.ts';
import { detectBestEditor, getPreset } from './editors/presets.ts';
import type { Settings } from './types.ts';
import { DEFAULT_TIMEOUT_MINUTES } from './types.ts';

// Show welcome message for first-time users
export async function handleFirstRun(): Promise<void> {
  if (!isFirstRun()) {
    return;
  }

  // Detect best available editor
  const detectedEditor = await detectBestEditor();
  const editorPreset = detectedEditor || 'vscode';
  const preset = getPreset(editorPreset);

  // Create default settings with detected editor
  const settings: Settings = {
    env: { EDITOR: preset?.command || 'code -r -w' },
    editorPreset,
    gotoFormat: preset?.gotoFormat || '-g {file}:{line}',
    timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
  };
  saveSettings(settings);

  // Show welcome message
  showWelcomeMessage(detectedEditor, preset);
}

// Check and handle first run (non-blocking for main command)
export async function checkFirstRun(showWelcome: boolean): Promise<void> {
  if (!isFirstRun()) {
    return;
  }

  // Detect best available editor
  const detectedEditor = await detectBestEditor();
  const editorPreset = detectedEditor || 'vscode';
  const preset = getPreset(editorPreset);

  // Create default settings with detected editor
  const settings: Settings = {
    env: { EDITOR: preset?.command || 'code -r -w' },
    editorPreset,
    gotoFormat: preset?.gotoFormat || '-g {file}:{line}',
    timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
  };
  saveSettings(settings);

  // Show welcome message if requested
  if (showWelcome) {
    showWelcomeMessage(detectedEditor, preset);
  }
}

// Display welcome message
function showWelcomeMessage(
  detectedEditor: string | null,
  preset: { command: string } | undefined
): void {
  console.log('');
  console.log(chalk.bold.cyan('Welcome to ask-me!'));
  console.log('');
  console.log(`${chalk.green('✓')} Settings created at: ${getSettingsPath()}`);
  console.log(`${chalk.green('✓')} Session files stored at: ${getConfigDir()}`);
  console.log('');

  if (detectedEditor) {
    console.log(
      `${chalk.green('✓')} Auto-detected editor: ${chalk.bold(detectedEditor)} (${preset?.command})`
    );
  } else {
    console.log(`${chalk.yellow('!')} No editor detected, using default: ${chalk.bold('vscode')}`);
    console.log(`  To change: ${chalk.cyan('ask-me editor use <name>')}`);
  }

  console.log('');
  console.log('To add Cursor rules to your project:');
  console.log(`  ${chalk.cyan('ask-me init')}`);
  console.log('');
  console.log('For help:');
  console.log(`  ${chalk.cyan('ask-me --help')}`);
  console.log('');
}
