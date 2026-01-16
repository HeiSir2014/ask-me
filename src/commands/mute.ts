import chalk from 'chalk';
import { isMuted, getMuteInfo, setMute, clearMute, getMuteSignalPath } from '../file-manager.ts';

// Handle mute command - enable global mute mode
export function handleMuteCommand(): void {
  console.log('');

  // Check if already muted
  if (isMuted()) {
    const info = getMuteInfo();
    console.log(`${chalk.yellow('⚠')} Already muted`);
    if (info.timestamp) {
      console.log(`  Muted since: ${chalk.dim(info.timestamp)}`);
    }
    console.log(`  Signal file: ${chalk.dim(getMuteSignalPath())}`);
    console.log('');
    console.log(`To unmute, run: ${chalk.cyan('ask-me unmute')}`);
    console.log('');
    return;
  }

  try {
    setMute('Muted by user command');

    console.log(`${chalk.green('✓')} Global mute enabled`);
    console.log('');
    console.log(`${chalk.bold('What happens now:')}`);
    console.log(`  - ask-me will ${chalk.cyan('NOT')} open the editor`);
    console.log(`  - After timeout, outputs ${chalk.cyan('"continue"')} to stdout`);
    console.log(`  - AI agents will continue automatically`);
    console.log('');
    console.log(`Signal file: ${chalk.dim(getMuteSignalPath())}`);
    console.log('');
    console.log(`To unmute, run: ${chalk.cyan('ask-me unmute')}`);
    console.log('');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`${chalk.red('✗')} Failed to enable mute: ${msg}`);
    console.log('');
  }
}

// Handle unmute command - disable global mute mode
export function handleUnmuteCommand(): void {
  console.log('');

  if (!isMuted()) {
    console.log(`${chalk.yellow('⚠')} Not muted`);
    console.log(`  No mute signal found.`);
    console.log('');
    return;
  }

  try {
    const info = getMuteInfo();
    clearMute();

    console.log(`${chalk.green('✓')} Global mute disabled`);
    if (info.timestamp) {
      console.log(`  Was muted since: ${chalk.dim(info.timestamp)}`);
    }
    console.log('');
    console.log(`${chalk.bold('Normal behavior restored:')}`);
    console.log(`  - ask-me will open the editor as usual`);
    console.log(`  - User input will be captured normally`);
    console.log('');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`${chalk.red('✗')} Failed to disable mute: ${msg}`);
    console.log('');
  }
}

// Handle mute status command - show current mute state
export function handleMuteStatusCommand(): void {
  console.log('');

  const info = getMuteInfo();

  if (info.muted) {
    console.log(`${chalk.yellow('⚡')} Mute: ${chalk.cyan('ENABLED')}`);
    if (info.timestamp) {
      console.log(`  Since: ${chalk.dim(info.timestamp)}`);
    }
    if (info.reason) {
      console.log(`  Reason: ${chalk.dim(info.reason)}`);
    }
    console.log(`  Signal: ${chalk.dim(getMuteSignalPath())}`);
    console.log('');
    console.log(`To unmute, run: ${chalk.cyan('ask-me unmute')}`);
  } else {
    console.log(`${chalk.green('○')} Mute: ${chalk.dim('disabled')}`);
    console.log(`  Normal mode - editor will open as usual`);
    console.log('');
    console.log(`To mute, run: ${chalk.cyan('ask-me mute')}`);
  }

  console.log('');
}
