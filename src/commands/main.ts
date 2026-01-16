import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import chalk from 'chalk';
import type { CLIOptions } from '../types.ts';
import { getCurrentEditor, getTimeoutMinutes } from '../config.ts';
import {
  getFilePath,
  fileExists,
  readFile,
  writeFile,
  withFileLock,
  archiveOldSessions,
  isMuted,
  getMuteInfo,
  getEditorLockInfo,
  tryAcquireEditorLock,
  releaseEditorLock,
  acquireEditorLock,
  mapCwdToDirName,
} from '../file-manager.ts';
import { generateNewFileContent, appendToExistingFile, extractUserInput } from '../template.ts';
import { validateInput } from '../input-validator.ts';
import { spawnEditor } from '../editor.ts';

// Remove pause signal file if exists (auto-resume on main command)
function removePauseFile(cwd: string): void {
  const pauseSignalFile = join(cwd, '.cursor', '.pause-signal');
  if (existsSync(pauseSignalFile)) {
    try {
      unlinkSync(pauseSignalFile);
    } catch {
      // Ignore errors
    }
  }
}

// Handle muted mode - wait timeout then output continue
async function handleMutedMode(timeoutMinutes: number): Promise<void> {
  const muteInfo = getMuteInfo();
  const timeoutMs = timeoutMinutes * 60 * 1000;

  // Print mute status to stderr
  console.error(
    chalk.yellow('⚡') +
      ' Muted mode - waiting ' +
      chalk.cyan(`${timeoutMinutes} min`) +
      ' before auto-continue...'
  );
  if (muteInfo.timestamp) {
    console.error(chalk.dim(`  Muted since: ${muteInfo.timestamp}`));
  }

  // Wait for timeout
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));

  // Output continue to stdout
  console.log('continue');
}

// Handle busy editor - wait or skip
async function handleBusyEditor(
  project: string,
  timeoutMinutes: number
): Promise<'acquired' | 'timeout'> {
  const lockInfo = getEditorLockInfo();

  console.error(
    chalk.yellow('⏳') + ' Editor in use by: ' + chalk.cyan(lockInfo.project || 'unknown project')
  );
  console.error(chalk.dim('  Waiting for editor to become available...'));

  // Try to acquire lock with wait
  const acquired = await acquireEditorLock(project);
  if (acquired) {
    console.error(chalk.green('✓') + ' Editor acquired');
    return 'acquired';
  }

  // Timeout reached
  console.error(chalk.yellow('⚠') + ' Timeout waiting for editor, auto-continuing...');
  return 'timeout';
}

// Handle main ask-me command
export async function handleMainCommand(options: CLIOptions): Promise<void> {
  // 0. Auto-resume: remove pause file if exists
  removePauseFile(options.cwd);

  // 1. Load settings & get editor config
  const { command, gotoFormat } = getCurrentEditor();
  const timeoutMinutes = getTimeoutMinutes();

  // 1.5. Check mute mode - skip editor and wait timeout
  if (isMuted()) {
    await handleMutedMode(timeoutMinutes);
    return;
  }

  // 2. Archive old sessions if needed (from previous days)
  archiveOldSessions(options.cwd);

  // 3. Map cwd → filename and get file path
  const filePath = getFilePath(options.cwd);
  const projectName = mapCwdToDirName(options.cwd);

  // 3.5. Check editor lock - wait if busy
  let editorLockAcquired = tryAcquireEditorLock(projectName);
  if (!editorLockAcquired) {
    const result = await handleBusyEditor(projectName, timeoutMinutes);
    if (result === 'timeout') {
      // Could not acquire editor in time, output continue
      console.log('continue');
      return;
    }
    editorLockAcquired = true;
  }

  try {
    // 4-6. Read, generate, and write with file lock to prevent race conditions
    const inputLine = await withFileLock(filePath, () => {
      // 4. Read existing file (if any)
      const existingContent = fileExists(filePath) ? readFile(filePath) : '';

      // 5. Generate/append session block
      let content: string;
      let line: number;

      if (existingContent) {
        const result = appendToExistingFile(existingContent, options);
        content = result.content;
        line = result.inputLine;
      } else {
        const result = generateNewFileContent(options);
        content = result.content;
        line = result.inputLine;
      }

      // 6. Write updated file
      writeFile(filePath, content);
      return line;
    });

    // 7. Spawn editor with goto line (track duration)
    const spawnResult = await spawnEditor(command, gotoFormat, filePath, inputLine);

    // 8-10. Read and validate with file lock
    await withFileLock(filePath, () => {
      // 8. Read file and extract user input
      const updatedContent = readFile(filePath);
      const userInput = extractUserInput(updatedContent);

      // 9. Validate input with duration and timeout status
      const validation = validateInput(
        userInput,
        spawnResult.durationMs,
        timeoutMinutes,
        spawnResult.timedOut
      );

      // 10. Output based on validation result
      if (validation.isValid) {
        // Valid input: output to stdout
        console.log(userInput);
      } else {
        // Empty input: print reminder to stderr
        if (validation.message) {
          console.error(validation.message);
        }
      }
    });
  } finally {
    // Release editor lock
    if (editorLockAcquired) {
      releaseEditorLock();
    }
  }

  // All paths exit with code 0 (required for Cursor)
}
