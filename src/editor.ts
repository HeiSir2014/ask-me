import { buildEditorCommand } from './editors/presets.ts';
import { getTimeoutMinutes } from './config.ts';

export interface SpawnResult {
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

// Spawn editor and wait for it to close (with timeout)
export async function spawnEditor(
  command: string,
  gotoFormat: string,
  file: string,
  line: number
): Promise<SpawnResult> {
  const startTime = Date.now();
  const timeoutMinutes = getTimeoutMinutes();
  const timeoutMs = timeoutMinutes * 60 * 1000;

  // Build full command with goto line
  const args = buildEditorCommand(command, gotoFormat, file, line);
  const [cmd, ...cmdArgs] = args;

  if (!cmd) {
    throw new Error('Editor command is empty');
  }

  try {
    // Spawn editor process
    const proc = Bun.spawn([cmd, ...cmdArgs], {
      stdio: ['inherit', 'inherit', 'inherit'],
    });

    // Race between process exit and timeout
    const exitPromise = proc.exited;
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), timeoutMs);
    });

    const result = await Promise.race([exitPromise, timeoutPromise]);
    const endTime = Date.now();

    if (result === 'timeout') {
      // Timeout reached, kill the process
      try {
        proc.kill();
      } catch {
        // Process may have already exited
      }

      return {
        exitCode: -1,
        durationMs: endTime - startTime,
        timedOut: true,
      };
    }

    // Normal exit
    return {
      exitCode: result,
      durationMs: endTime - startTime,
      timedOut: false,
    };
  } catch (error) {
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if editor command not found
    if (
      errorMessage.includes('ENOENT') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('spawn')
    ) {
      throw new Error(
        `Editor command '${cmd}' not found. ` +
          `Please ensure the editor is installed and in your PATH, ` +
          `or use 'ask-me editor use <name>' to switch editors.`
      );
    }

    throw new Error(`Failed to spawn editor: ${errorMessage}`);
  }
}
