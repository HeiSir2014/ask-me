import chalk from 'chalk';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import type { PauseCommand } from '../types.ts';

// Handle pause command - create .cursor/pause file
export function handlePauseCommand(command: PauseCommand): void {
  const cursorDir = join(command.targetDir, '.cursor');
  const pauseFile = join(cursorDir, 'pause');

  console.log('');

  // Check if already paused
  if (existsSync(pauseFile)) {
    console.log(`${chalk.yellow('⚠')} Already paused`);
    console.log(`  Pause file exists: ${chalk.dim(pauseFile)}`);
    console.log('');
    console.log(`To resume, run: ${chalk.cyan('ask-me resume')}`);
    console.log('');
    return;
  }

  try {
    // Create .cursor directory if needed
    if (!existsSync(cursorDir)) {
      mkdirSync(cursorDir, { recursive: true });
    }

    // Create pause file
    writeFileSync(pauseFile, 'pause', 'utf-8');

    console.log(`${chalk.green('✓')} Cursor AI agent paused`);
    console.log(`  Created: ${chalk.dim(pauseFile)}`);
    console.log('');
    console.log(`To resume, run: ${chalk.cyan('ask-me resume')}`);
    console.log('');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`${chalk.red('✗')} Failed to pause: ${msg}`);
    console.log('');
  }
}

// Handle resume command - remove .cursor/pause file
export function handleResumeCommand(command: PauseCommand): void {
  const cursorDir = join(command.targetDir, '.cursor');
  const pauseFile = join(cursorDir, 'pause');

  console.log('');

  // Check if not paused
  if (!existsSync(pauseFile)) {
    console.log(`${chalk.yellow('⚠')} Not paused`);
    console.log(`  No pause file found.`);
    console.log('');
    return;
  }

  try {
    // Remove pause file
    unlinkSync(pauseFile);

    console.log(`${chalk.green('✓')} Cursor AI agent resumed`);
    console.log(`  Removed: ${chalk.dim(pauseFile)}`);
    console.log('');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`${chalk.red('✗')} Failed to resume: ${msg}`);
    console.log('');
  }
}
