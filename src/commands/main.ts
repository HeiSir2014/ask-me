import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import type { CLIOptions } from '../types.ts';
import { getCurrentEditor, getTimeoutMinutes } from '../config.ts';
import {
  getFilePath,
  fileExists,
  readFile,
  writeFile,
  withFileLock,
  archiveOldSessions,
} from '../file-manager.ts';
import { generateNewFileContent, appendToExistingFile, extractUserInput } from '../template.ts';
import { validateInput } from '../input-validator.ts';
import { spawnEditor } from '../editor.ts';

// Remove pause file if exists (auto-resume on main command)
function removePauseFile(cwd: string): void {
  const pauseFile = join(cwd, '.cursor', 'pause');
  if (existsSync(pauseFile)) {
    try {
      unlinkSync(pauseFile);
    } catch {
      // Ignore errors
    }
  }
}

// Handle main ask-me command
export async function handleMainCommand(options: CLIOptions): Promise<void> {
  // 0. Auto-resume: remove pause file if exists
  removePauseFile(options.cwd);

  // 1. Load settings & get editor config
  const { command, gotoFormat } = getCurrentEditor();
  const timeoutMinutes = getTimeoutMinutes();

  // 2. Archive old sessions if needed (from previous days)
  archiveOldSessions(options.cwd);

  // 3. Map cwd → filename and get file path
  const filePath = getFilePath(options.cwd);

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

  // All paths exit with code 0 (required for Cursor)
}
