import chalk from 'chalk';
import { getCurrentEditor, getSettingsPath, loadSettings, validateSettings } from '../config.ts';
import { spawnEditor } from '../editor.ts';

// Handle config command - edit settings in default editor
export async function handleConfigCommand(): Promise<void> {
  const settingsPath = getSettingsPath();
  const { command, gotoFormat } = getCurrentEditor();

  console.log('');
  console.log(chalk.bold('Opening settings in editor...'));
  console.log(`  ${chalk.dim(settingsPath)}`);
  console.log('');

  // Open settings file in editor (line 1)
  const result = await spawnEditor(command, gotoFormat, settingsPath, 1);

  // Validate settings after editing
  console.log('');
  console.log(chalk.bold('Validating settings...'));

  const validation = validateSettings();

  if (!validation.valid) {
    console.log('');
    console.log(`${chalk.red('✗')} Invalid settings:`);
    for (const error of validation.errors) {
      console.log(`  ${chalk.red('•')} ${error}`);
    }
    console.log('');
    console.log(`Settings reset to defaults. Please try again.`);
    console.log('');
    return;
  }

  // Show current settings
  const settings = loadSettings();
  console.log('');
  console.log(`${chalk.green('✓')} Settings valid`);
  console.log('');
  console.log(chalk.bold('Current Configuration:'));
  console.log('');
  console.log(
    `  ${chalk.cyan('Editor')}         ${chalk.green(settings.editorPreset || 'custom')}`
  );
  console.log(
    `  ${chalk.cyan('Command')}        ${chalk.yellow(settings.env?.EDITOR || '(default)')}`
  );
  console.log(`  ${chalk.cyan('Goto Format')}    ${chalk.dim(settings.gotoFormat || '(default)')}`);
  console.log(
    `  ${chalk.cyan('Timeout')}        ${chalk.magenta((settings.timeoutMinutes || 4) + ' minutes')}`
  );
  console.log('');
}
