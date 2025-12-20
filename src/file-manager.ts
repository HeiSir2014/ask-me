import { join, resolve, dirname } from 'path';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
  renameSync,
} from 'fs';
import { getFilesDir, ensureConfigDir } from './config.ts';

// Simple file locking to prevent concurrent access
const LOCK_TIMEOUT_MS = 30000; // 30 seconds
const LOCK_RETRY_MS = 100; // 100ms between retries

// Acquire a lock file
async function acquireLock(path: string): Promise<string> {
  const lockPath = `${path}.lock`;
  const startTime = Date.now();

  while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
    try {
      // Try to create lock file exclusively
      if (!existsSync(lockPath)) {
        writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
        return lockPath;
      }

      // Check if lock is stale (older than timeout)
      const stats = Bun.file(lockPath);
      const lockAge = Date.now() - (await stats.lastModified);
      if (lockAge > LOCK_TIMEOUT_MS) {
        // Remove stale lock
        unlinkSync(lockPath);
        continue;
      }

      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    } catch {
      // Error creating lock, retry
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
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
  // Resolve to absolute path first (handles "." and relative paths)
  let absolutePath = resolve(cwd);

  // Normalize to lowercase on Windows (case-insensitive filesystem)
  if (process.platform === 'win32') {
    absolutePath = absolutePath.toLowerCase();
  }

  // Normalize path separators and remove drive colon on Windows
  let normalized = absolutePath
    .replace(/\\/g, '-') // Replace backslashes
    .replace(/\//g, '-') // Replace forward slashes
    .replace(/:/g, '') // Remove colons (Windows drive letters)
    .replace(/^-+/, '') // Remove leading dashes
    .replace(/-+$/g, '') // Remove trailing dashes
    .replace(/-+/g, '-'); // Collapse multiple dashes

  // Ensure name is not empty
  if (!normalized) {
    normalized = 'default';
  }

  return normalized;
}

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
