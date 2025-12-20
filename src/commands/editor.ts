import chalk from 'chalk';
import type { EditorCommand } from '../types.ts';
import { getCurrentEditor, setEditorPreset, setCustomEditor, loadSettings } from '../config.ts';
import { getAllPresets, getPreset, getPresetNames, isEditorInstalled } from '../editors/presets.ts';

// Handle editor subcommand
export async function handleEditorCommand(cmd: EditorCommand): Promise<void> {
  switch (cmd.subcommand) {
    case 'list':
      await listEditors();
      break;
    case 'current':
      await showCurrentEditor();
      break;
    case 'use':
      await useEditor(cmd.value!);
      break;
    case 'set':
      setEditor(cmd.value!);
      break;
  }
}

// List all available editors
async function listEditors(): Promise<void> {
  const presets = getAllPresets();
  const settings = loadSettings();
  const currentPreset = settings.editorPreset;

  // Check which editors are installed
  const installedStatus = await Promise.all(
    presets.map(async (preset) => ({
      preset,
      installed: await isEditorInstalled(preset),
    }))
  );

  console.log('');
  console.log(chalk.bold('Available Editors:'));
  console.log('');
  console.log(
    `  ${chalk.dim('Name')}            ${chalk.dim('Command')}              ${chalk.dim('Description')}`
  );
  console.log(chalk.dim('  ──────────────────────────────────────────────────────────────────'));

  for (const { preset, installed } of installedStatus) {
    const isCurrent = preset.name === currentPreset;
    const marker = isCurrent ? chalk.green('*') : ' ';
    const name = preset.name.padEnd(14);
    const command = preset.command.padEnd(20);
    const description = preset.description;
    const status = installed ? chalk.green('✓') : chalk.dim('○');

    if (isCurrent) {
      // Current editor: green highlight
      console.log(
        `${marker} ${status} ${chalk.green(name)} ${chalk.green(command)} ${chalk.green(description)}`
      );
    } else if (installed) {
      // Installed but not current: normal color
      console.log(`${marker} ${status} ${name} ${command} ${description}`);
    } else {
      // Not installed: dim/gray
      console.log(
        `${marker} ${status} ${chalk.dim(name)} ${chalk.dim(command)} ${chalk.dim(description)}`
      );
    }
  }

  console.log('');
  console.log(`${chalk.green('✓')} = installed, ${chalk.dim('○')} = not found`);
  console.log(`Current: ${chalk.cyan(currentPreset ?? 'custom')}`);
  console.log('');
}

// Show current editor configuration
async function showCurrentEditor(): Promise<void> {
  const settings = loadSettings();
  const { command, gotoFormat } = getCurrentEditor();

  console.log('');
  console.log(chalk.bold('Current Editor Configuration:'));
  console.log('');

  if (settings.editorPreset) {
    const preset = getPreset(settings.editorPreset);
    if (preset) {
      const installed = await isEditorInstalled(preset);
      const status = installed ? chalk.green('✓ installed') : chalk.yellow('⚠ not found');
      console.log(`  ${chalk.dim('Preset:')}      ${chalk.cyan(preset.name)} (${status})`);
      console.log(`  ${chalk.dim('Command:')}     ${preset.command}`);
      console.log(`  ${chalk.dim('Goto Format:')} ${preset.gotoFormat}`);
      console.log(`  ${chalk.dim('Description:')} ${preset.description}`);
    }
  } else {
    console.log(`  ${chalk.dim('Preset:')}      ${chalk.yellow('(custom)')}`);
    console.log(`  ${chalk.dim('Command:')}     ${command}`);
    console.log(`  ${chalk.dim('Goto Format:')} ${gotoFormat}`);
  }

  console.log('');
}

// Switch to a preset editor
async function useEditor(name: string): Promise<void> {
  const preset = getPreset(name);

  if (!preset) {
    console.error('');
    console.error(`${chalk.red('Error:')} Unknown editor preset '${chalk.yellow(name)}'`);
    console.error('');
    console.error(`Available presets: ${chalk.cyan(getPresetNames().join(', '))}`);
    console.error('');
    return;
  }

  // Check if editor is installed
  const installed = await isEditorInstalled(preset);
  if (!installed) {
    console.log('');
    console.log(`${chalk.yellow('⚠')} Editor '${chalk.cyan(preset.name)}' not found in PATH`);
    console.log(`  Make sure '${preset.command.split(/\s+/)[0]}' is installed and in your PATH.`);
    console.log('');
  }

  const success = setEditorPreset(name);

  if (success) {
    console.log('');
    console.log(`${chalk.green('✓')} Switched to ${chalk.cyan(preset.name)} (${preset.command})`);
    if (!installed) {
      console.log(`  ${chalk.dim('Note: Editor not found, but setting saved.')}`);
    }
    console.log('');
  } else {
    console.error('');
    console.error(`${chalk.red('✗')} Failed to switch editor.`);
    console.error('');
  }
}

// Set custom editor command
function setEditor(command: string): void {
  // Try to detect goto format from command
  let gotoFormat = '-g {file}:{line}'; // Default VSCode-style

  // Check for common patterns
  if (
    command.includes('vim') ||
    command.includes('nvim') ||
    command.includes('nano') ||
    command.includes('emacs')
  ) {
    gotoFormat = '+{line} {file}';
  } else if (command.includes('notepad++')) {
    gotoFormat = '-n{line} {file}';
  } else if (command.includes('mate')) {
    gotoFormat = '-l {line} {file}';
  }

  setCustomEditor(command, gotoFormat);

  console.log('');
  console.log(`${chalk.green('✓')} Custom editor set: ${chalk.cyan(command)}`);
  console.log(`  Goto format: ${gotoFormat}`);
  console.log('');
  console.log(
    `${chalk.dim('Tip:')} If the goto format is incorrect, edit ${chalk.cyan('~/.ask-me/settings.json')}`
  );
  console.log('');
}
