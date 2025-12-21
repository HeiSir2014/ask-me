import chalk from 'chalk';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import type { PauseCommand } from '../types.ts';
import { getTodayDate, getLocalTimestamp, normalizeCwdPath } from '../utils/index.ts';

// Handle pause command - create .cursor/.pause-signal file
export function handlePauseCommand(command: PauseCommand): void {
  const cwd = command.targetDir;

  // 构建审计文件路径（使用统一的 ~/.ask-me/projects/{project}/ 目录）
  const today = getTodayDate();
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const normalizedProject = normalizeCwdPath(cwd);
  const auditDir = join(homeDir, '.ask-me', 'projects', normalizedProject, today);

  const pauseSignalFile = join(cwd, '.cursor', '.pause-signal');
  const pauseDataFile = join(auditDir, 'pause-data.json');

  console.log('');

  // Check if already paused
  if (existsSync(pauseSignalFile)) {
    console.log(`${chalk.yellow('⚠')} Already paused`);
    console.log(`  Pause signal exists: ${chalk.dim(pauseSignalFile)}`);
    console.log('');
    console.log(`To resume, run: ${chalk.cyan('ask-me resume')}`);
    console.log('');
    return;
  }

  try {
    // Create .cursor directory if needed
    const cursorDir = join(cwd, '.cursor');
    if (!existsSync(cursorDir)) {
      mkdirSync(cursorDir, { recursive: true });
    }

    // Create audit directory if needed
    if (!existsSync(auditDir)) {
      mkdirSync(auditDir, { recursive: true });
    }

    // Create pause signal with extended context
    const pauseData = {
      timestamp: getLocalTimestamp(),
      triggeredBy: 'user-command',
      reason: 'Manually paused by user',
      pid: process.pid,
      cwd: cwd,
    };

    writeFileSync(pauseSignalFile, 'paused', 'utf-8');
    writeFileSync(pauseDataFile, JSON.stringify(pauseData, null, 2), 'utf-8');

    console.log(`${chalk.green('✓')} Cursor AI agent paused`);
    console.log(`  Signal: ${chalk.dim(pauseSignalFile)}`);
    console.log(`  Working directory: ${chalk.dim(cwd)}`);
    console.log(`  Hooks will detect pause on next operation`);
    console.log('');
    console.log(`To resume, run: ${chalk.cyan('ask-me resume')}`);
    console.log('');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`${chalk.red('✗')} Failed to pause: ${msg}`);
    console.log('');
  }
}

// Handle resume command - remove .cursor/.pause-signal file
export function handleResumeCommand(command: PauseCommand): void {
  const cwd = command.targetDir;

  // 构建审计文件路径（使用统一的 ~/.ask-me/projects/{project}/ 目录）
  const today = getTodayDate();
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const normalizedProject = normalizeCwdPath(cwd);
  const auditDir = join(homeDir, '.ask-me', 'projects', normalizedProject, today);

  const pauseSignalFile = join(cwd, '.cursor', '.pause-signal');
  const pauseDataFile = join(auditDir, 'pause-data.json');

  console.log('');

  if (!existsSync(pauseSignalFile)) {
    console.log(`${chalk.yellow('⚠')} Not paused`);
    console.log(`  No pause signal found.`);
    console.log('');
    return;
  }

  try {
    // Remove pause files
    unlinkSync(pauseSignalFile);
    if (existsSync(pauseDataFile)) {
      unlinkSync(pauseDataFile);
    }

    console.log(`${chalk.green('✓')} Cursor AI agent resumed`);
    console.log(`  Removed: ${chalk.dim(pauseSignalFile)}`);
    console.log('');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`${chalk.red('✗')} Failed to resume: ${msg}`);
    console.log('');
  }
}
