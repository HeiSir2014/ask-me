import { join } from 'path';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
} from 'fs';
import { getFilesDir, ensureConfigDir } from './config.ts';
import { getTodayDate, normalizeCwdPath } from './utils/index.ts';

// Simple file locking to prevent concurrent access
const LOCK_TIMEOUT_MS = 30000; // 30 seconds
const LOCK_RETRY_MS = 100; // 100ms between retries
const STALE_LOCK_MS = 60000; // 60 seconds - consider lock stale if older

// Check if a process is still running
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Try to acquire lock atomically
// Note: Uses writeFileSync with 'wx' flag instead of openSync with O_EXCL due to Bun bug on Windows
function tryAtomicLock(lockPath: string): boolean {
  try {
    // 'wx' flag ensures atomic creation - fails if file exists
    writeFileSync(lockPath, String(process.pid), { flag: 'wx', mode: 0o644 });
    return true;
  } catch {
    return false;
  }
}

// Check if lock is stale (process dead or lock too old)
function isLockStale(lockPath: string): boolean {
  try {
    if (!existsSync(lockPath)) {
      return true;
    }

    // Read PID from lock file
    const content = readFileSync(lockPath, 'utf-8').trim();
    const pid = parseInt(content, 10);

    // If PID is valid, check if process is still running
    if (!isNaN(pid) && pid > 0) {
      if (!isProcessRunning(pid)) {
        return true; // Process is dead, lock is stale
      }
    }

    // Check lock age as fallback
    try {
      const stats = statSync(lockPath);
      const lockAge = Date.now() - stats.mtimeMs;
      if (lockAge > STALE_LOCK_MS) {
        return true;
      }
    } catch {
      // If we can't stat, consider stale
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

// Acquire a lock file
async function acquireLock(path: string): Promise<string> {
  const lockPath = `${path}.lock`;
  const startTime = Date.now();

  while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
    // First, try atomic lock creation
    if (tryAtomicLock(lockPath)) {
      return lockPath;
    }

    // Lock exists - check if it's stale
    if (isLockStale(lockPath)) {
      try {
        unlinkSync(lockPath);
        // Try again immediately after removing stale lock
        if (tryAtomicLock(lockPath)) {
          return lockPath;
        }
      } catch {
        // Another process might have removed it, continue
      }
    }

    // Wait and retry
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }

  throw new Error(`Failed to acquire lock for ${path} after ${LOCK_TIMEOUT_MS}ms`);
}

// Release a lock file
function releaseLock(lockPath: string): void {
  try {
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  } catch {
    // Ignore errors when releasing lock
  }
}

// Execute function with file lock
export async function withFileLock<T>(path: string, fn: () => T | Promise<T>): Promise<T> {
  const lockPath = await acquireLock(path);
  try {
    return await fn();
  } finally {
    releaseLock(lockPath);
  }
}

// Map CWD path to a safe directory name
export function mapCwdToDirName(cwd: string): string {
  // Use the centralized normalizeCwdPath function
  return normalizeCwdPath(cwd);
}

// Get project directory path
export function getProjectDir(cwd: string): string {
  ensureConfigDir();
  const dirName = mapCwdToDirName(cwd);
  const projectDir = join(getFilesDir(), 'projects', dirName);

  // Create directory if not exists
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }

  return projectDir;
}

// Get latest session file path for a project
export function getFilePath(cwd: string): string {
  const projectDir = getProjectDir(cwd);
  return join(projectDir, 'latest.md');
}

// Archive yesterday's sessions if needed
export function archiveOldSessions(cwd: string): void {
  const projectDir = getProjectDir(cwd);
  const latestPath = join(projectDir, 'latest.md');

  if (!existsSync(latestPath)) {
    return;
  }

  // Read latest file to check if it has content from previous days
  const content = readFileSync(latestPath, 'utf-8');
  if (!content.trim()) {
    return;
  }

  // Extract the first session date from the file
  const dateMatch = content.match(/## Session: (\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) {
    return;
  }

  const firstSessionDate = dateMatch[1];
  const today = getTodayDate();

  // If first session is from a previous day, archive the file
  if (firstSessionDate && firstSessionDate !== today) {
    const archivePath = join(projectDir, `${firstSessionDate}.md`);

    // If archive already exists, append to it
    if (existsSync(archivePath)) {
      const existingArchive = readFileSync(archivePath, 'utf-8');
      writeFileSync(archivePath, existingArchive + '\n' + content, 'utf-8');
    } else {
      renameSync(latestPath, archivePath);
    }
  }
}

// Check if file exists
export function fileExists(path: string): boolean {
  return existsSync(path);
}

// Read file content
export function readFile(path: string): string {
  if (!existsSync(path)) {
    return '';
  }
  return readFileSync(path, 'utf-8');
}

// Write file content
export function writeFile(path: string, content: string): void {
  writeFileSync(path, content, 'utf-8');
}

// Count lines in content
export function countLines(content: string): number {
  if (!content) {
    return 0;
  }
  return content.split('\n').length;
}

// ============================================
// Global Editor Lock (for concurrent usage)
// ============================================

const EDITOR_LOCK_TIMEOUT_MS = 300000; // 5 minutes max wait for editor lock
const EDITOR_LOCK_RETRY_MS = 500; // 500ms between retries

// Get global editor lock file path
export function getEditorLockPath(): string {
  ensureConfigDir();
  return join(getFilesDir(), 'editor.lock');
}

// Get editor lock info (which project is using the editor)
export interface EditorLockInfo {
  locked: boolean;
  pid?: number;
  project?: string;
  startTime?: number;
}

// Result type for tryAcquireEditorLock - distinguishes between "busy" and "error"
export type AcquireLockResult =
  | { acquired: true }
  | { acquired: false; busy: true; holder: EditorLockInfo }
  | { acquired: false; busy: false; error: string };

export function getEditorLockInfo(): EditorLockInfo {
  const lockPath = getEditorLockPath();
  if (!existsSync(lockPath)) {
    return { locked: false };
  }

  try {
    const content = readFileSync(lockPath, 'utf-8');
    const data = JSON.parse(content);
    const pid = data.pid;

    // Check if process is still running
    if (pid && !isProcessRunning(pid)) {
      // Process is dead, lock is stale
      try {
        unlinkSync(lockPath);
      } catch {
        // ignore
      }
      return { locked: false };
    }

    return {
      locked: true,
      pid: data.pid,
      project: data.project,
      startTime: data.startTime,
    };
  } catch {
    // JSON parse error or read error - lock file is corrupted, remove it
    try {
      unlinkSync(lockPath);
    } catch {
      // ignore
    }
    return { locked: false };
  }
}

// Try to acquire editor lock - returns detailed result
// Note: Uses writeFileSync with 'wx' flag instead of openSync with O_EXCL due to Bun bug on Windows
export function tryAcquireEditorLock(project: string): AcquireLockResult {
  const lockPath = getEditorLockPath();

  // Check if already locked by another process
  const info = getEditorLockInfo();
  if (info.locked) {
    return { acquired: false, busy: true, holder: info };
  }

  // Try to acquire atomically using writeFileSync with 'wx' flag (exclusive create)
  const lockData = JSON.stringify({
    pid: process.pid,
    project: project,
    startTime: Date.now(),
  });

  try {
    writeFileSync(lockPath, lockData, { flag: 'wx', mode: 0o644 });
    return { acquired: true };
  } catch (err) {
    // 'wx' failed - file exists or other error
    // Check if another process has the lock
    if (existsSync(lockPath)) {
      const retryInfo = getEditorLockInfo();
      if (retryInfo.locked) {
        // Another process acquired the lock
        return { acquired: false, busy: true, holder: retryInfo };
      }
      // Still shows unlocked, force remove and retry
      try {
        unlinkSync(lockPath);
        writeFileSync(lockPath, lockData, { flag: 'wx', mode: 0o644 });
        return { acquired: true };
      } catch (retryErr) {
        // Check one more time if another process got the lock
        const finalInfo = getEditorLockInfo();
        if (finalInfo.locked) {
          return { acquired: false, busy: true, holder: finalInfo };
        }
        const errMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        return { acquired: false, busy: false, error: `Failed to create lock file: ${errMsg}` };
      }
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    return { acquired: false, busy: false, error: `Failed to create lock file: ${errMsg}` };
  }
}

// Acquire editor lock with wait (blocks until acquired or timeout)
export async function acquireEditorLock(project: string): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < EDITOR_LOCK_TIMEOUT_MS) {
    const result = tryAcquireEditorLock(project);
    if (result.acquired) {
      return true;
    }

    // If it's an error (not busy), retry immediately
    if (!result.busy) {
      continue;
    }

    // Wait and retry
    await new Promise((resolve) => setTimeout(resolve, EDITOR_LOCK_RETRY_MS));
  }

  return false;
}

// Release editor lock
export function releaseEditorLock(): void {
  const lockPath = getEditorLockPath();
  try {
    if (existsSync(lockPath)) {
      // Only release if we own the lock
      const content = readFileSync(lockPath, 'utf-8');
      const data = JSON.parse(content);
      if (data.pid === process.pid) {
        unlinkSync(lockPath);
      }
    }
  } catch {
    // Ignore errors
  }
}

// Execute function with editor lock
export async function withEditorLock<T>(
  project: string,
  fn: () => T | Promise<T>,
  options?: { skipIfBusy?: boolean }
): Promise<{ result: T; skipped: false } | { skipped: true; busyProject: string }> {
  // Try to acquire lock
  const lockResult = tryAcquireEditorLock(project);

  if (!lockResult.acquired) {
    if (lockResult.busy) {
      // Lock is held by another process
      if (options?.skipIfBusy) {
        return { skipped: true, busyProject: lockResult.holder.project || 'unknown' };
      }
      // Wait for lock
      const acquired = await acquireEditorLock(project);
      if (!acquired) {
        const info = getEditorLockInfo();
        return { skipped: true, busyProject: info.project || 'unknown' };
      }
    } else {
      // Error acquiring lock, skip if allowed
      if (options?.skipIfBusy) {
        return { skipped: true, busyProject: `error: ${lockResult.error}` };
      }
      // Wait and retry
      const acquired = await acquireEditorLock(project);
      if (!acquired) {
        return { skipped: true, busyProject: 'unknown (failed to acquire)' };
      }
    }
  }

  try {
    const result = await fn();
    return { result, skipped: false };
  } finally {
    releaseEditorLock();
  }
}

// ============================================
// Global Mute Signal
// ============================================

// Get global mute signal file path
export function getMuteSignalPath(): string {
  ensureConfigDir();
  return join(getFilesDir(), 'mute-signal');
}

// Check if muted
export function isMuted(): boolean {
  return existsSync(getMuteSignalPath());
}

// Get mute info
export interface MuteInfo {
  muted: boolean;
  timestamp?: string;
  reason?: string;
}

export function getMuteInfo(): MuteInfo {
  const mutePath = getMuteSignalPath();
  if (!existsSync(mutePath)) {
    return { muted: false };
  }

  try {
    const content = readFileSync(mutePath, 'utf-8');
    const data = JSON.parse(content);
    return {
      muted: true,
      timestamp: data.timestamp,
      reason: data.reason,
    };
  } catch {
    return { muted: true };
  }
}

// Set mute
export function setMute(reason?: string): void {
  const mutePath = getMuteSignalPath();
  const data = {
    timestamp: new Date().toISOString(),
    reason: reason || 'Muted by user',
    pid: process.pid,
  };
  writeFileSync(mutePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Clear mute
export function clearMute(): void {
  const mutePath = getMuteSignalPath();
  if (existsSync(mutePath)) {
    unlinkSync(mutePath);
  }
}
