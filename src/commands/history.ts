import chalk from 'chalk';
import { join, basename } from 'path';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import type { HistoryCommand } from '../types.ts';
import { getFilesDir } from '../config.ts';

// Session info extracted from file
interface SessionInfo {
  timestamp: string;
  title: string;
  hasInput: boolean;
}

// Project info with sessions
interface ProjectInfo {
  name: string;
  path: string;
  files: FileInfo[];
}

// File info
interface FileInfo {
  name: string;
  path: string;
  modifiedAt: Date;
  isLatest: boolean;
}

// Handle history command
export function handleHistoryCommand(command: HistoryCommand): void {
  const projectsDir = join(getFilesDir(), 'projects');

  if (!existsSync(projectsDir)) {
    console.log('');
    console.log(chalk.yellow('No session history found.'));
    console.log('');
    console.log(`Session files are stored in: ${chalk.dim(projectsDir)}`);
    console.log('');
    return;
  }

  // Get all projects
  const projects = getProjects(projectsDir);

  if (projects.length === 0) {
    console.log('');
    console.log(chalk.yellow('No session history found.'));
    console.log('');
    return;
  }

  // Filter by project if specified
  if (command.project) {
    const filtered = projects.filter((p) =>
      p.name.toLowerCase().includes(command.project!.toLowerCase())
    );

    if (filtered.length === 0) {
      console.log('');
      console.log(chalk.yellow(`No project matching '${command.project}' found.`));
      console.log('');
      console.log('Available projects:');
      for (const p of projects) {
        console.log(`  ${chalk.dim('-')} ${p.name}`);
      }
      console.log('');
      return;
    }

    showProjectHistory(filtered, command.limit || 10);
  } else {
    showAllProjects(projects, command.limit || 10);
  }
}

// Get all projects from projects directory
function getProjects(projectsDir: string): ProjectInfo[] {
  const projects: ProjectInfo[] = [];

  try {
    const entries = readdirSync(projectsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = join(projectsDir, entry.name);
        const files = getProjectFiles(projectPath);

        if (files.length > 0) {
          projects.push({
            name: entry.name,
            path: projectPath,
            files,
          });
        }
      }
    }
  } catch {
    // Ignore errors
  }

  // Sort by most recent activity
  projects.sort((a, b) => {
    const aLatest = a.files[0]?.modifiedAt.getTime() || 0;
    const bLatest = b.files[0]?.modifiedAt.getTime() || 0;
    return bLatest - aLatest;
  });

  return projects;
}

// Get all .md files in a project directory
function getProjectFiles(projectPath: string): FileInfo[] {
  const files: FileInfo[] = [];

  try {
    const entries = readdirSync(projectPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const filePath = join(projectPath, entry.name);
        const stats = statSync(filePath);

        files.push({
          name: entry.name,
          path: filePath,
          modifiedAt: stats.mtime,
          isLatest: entry.name === 'latest.md',
        });
      }
    }
  } catch {
    // Ignore errors
  }

  // Sort: latest.md first, then by date descending
  files.sort((a, b) => {
    if (a.isLatest) return -1;
    if (b.isLatest) return 1;
    return b.modifiedAt.getTime() - a.modifiedAt.getTime();
  });

  return files;
}

// Show all projects summary
function showAllProjects(projects: ProjectInfo[], limit: number): void {
  console.log('');
  console.log(chalk.bold('Session History'));
  console.log('');

  const displayProjects = projects.slice(0, limit);

  for (const project of displayProjects) {
    const latestFile = project.files.find((f) => f.isLatest);
    const archiveCount = project.files.filter((f) => !f.isLatest).length;
    const lastModified = formatDate(project.files[0]?.modifiedAt);

    console.log(`  ${chalk.cyan(project.name)}`);
    console.log(`    ${chalk.dim('Last activity:')} ${lastModified}`);
    console.log(
      `    ${chalk.dim('Files:')} ${latestFile ? 'latest.md' : ''} ${archiveCount > 0 ? `+ ${archiveCount} archived` : ''}`
    );

    // Show sessions from latest.md
    if (latestFile) {
      const sessions = extractSessions(latestFile.path, 3);
      if (sessions.length > 0) {
        console.log(`    ${chalk.dim('Recent sessions:')}`);
        for (const session of sessions) {
          const statusIcon = session.hasInput ? chalk.green('✓') : chalk.yellow('○');
          console.log(`      ${statusIcon} ${chalk.dim(session.timestamp)} ${session.title}`);
        }
      }
    }
    console.log('');
  }

  if (projects.length > limit) {
    console.log(chalk.dim(`  ... and ${projects.length - limit} more projects`));
    console.log('');
  }

  console.log(
    chalk.dim(`Use ${chalk.cyan('ask-me history -p <project>')} to view specific project`)
  );
  console.log('');
}

// Show detailed history for specific projects
function showProjectHistory(projects: ProjectInfo[], limit: number): void {
  console.log('');

  for (const project of projects) {
    console.log(chalk.bold(`Project: ${project.name}`));
    console.log(chalk.dim(`Path: ${project.path}`));
    console.log('');

    let sessionCount = 0;

    for (const file of project.files) {
      if (sessionCount >= limit) break;

      const sessions = extractSessions(file.path, limit - sessionCount);
      if (sessions.length === 0) continue;

      const fileLabel = file.isLatest ? chalk.green('latest.md') : chalk.dim(file.name);

      console.log(`  ${chalk.bold(fileLabel)}`);

      for (const session of sessions) {
        const statusIcon = session.hasInput ? chalk.green('✓') : chalk.yellow('○');
        console.log(`    ${statusIcon} ${chalk.dim(session.timestamp)}`);
        console.log(`      ${session.title}`);
        sessionCount++;
      }
      console.log('');
    }

    if (sessionCount === 0) {
      console.log(chalk.dim('  No sessions found.'));
      console.log('');
    }
  }
}

// Extract session info from markdown file
function extractSessions(filePath: string, limit: number): SessionInfo[] {
  const sessions: SessionInfo[] = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let currentSession: Partial<SessionInfo> | null = null;
    let inUserInput = false;
    let hasUserContent = false;

    for (const line of lines) {
      // Session header: ## Session: 2025-12-19 10:00:00
      const sessionMatch = line.match(/^## Session:\s*(.+)$/);
      if (sessionMatch) {
        // Save previous session
        if (currentSession?.timestamp) {
          sessions.push({
            timestamp: currentSession.timestamp,
            title: currentSession.title || '(no title)',
            hasInput: hasUserContent,
          });
          if (sessions.length >= limit) break;
        }

        currentSession = { timestamp: sessionMatch[1] };
        inUserInput = false;
        hasUserContent = false;
        continue;
      }

      // Title: **Title**: DONE: Something
      const titleMatch = line.match(/^\*\*Title\*\*:\s*(.+)$/);
      if (titleMatch && currentSession) {
        currentSession.title = titleMatch[1];
        continue;
      }

      // User input marker
      if (line.includes('<!-- ✏️') || line.includes('### User Input')) {
        inUserInput = true;
        continue;
      }

      // Check for user content after input marker
      if (inUserInput && line.trim() && !line.startsWith('<!--')) {
        hasUserContent = true;
      }
    }

    // Don't forget last session
    if (currentSession?.timestamp && sessions.length < limit) {
      sessions.push({
        timestamp: currentSession.timestamp,
        title: currentSession.title || '(no title)',
        hasInput: hasUserContent,
      });
    }
  } catch {
    // Ignore errors
  }

  return sessions;
}

// Format date for display
function formatDate(date: Date | undefined): string {
  if (!date) return 'unknown';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
