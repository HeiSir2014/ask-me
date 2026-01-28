import chalk from 'chalk';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, lstatSync, readlinkSync } from 'fs';
import type { InitCommand } from '../types.ts';
import { getAskMeMdcContent } from '../assets/embedded.ts';

// Check if running as compiled binary (not via `bun run`)
function isCompiledBinary(): boolean {
  const execPath = process.execPath;
  // Development mode: execPath points to bun executable
  if (execPath.toLowerCase().includes('bun')) {
    return false;
  }
  // Compiled binary: execPath is the actual executable
  return true;
}

// Get the current executable path
function getCurrentExecutable(): string {
  return process.execPath;
}

// Get user local bin directory (preferred, no sudo needed)
function getUserLocalBinDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (process.platform === 'win32') {
    // Windows: use %LOCALAPPDATA%\Programs or fallback to home\.local\bin
    return process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, 'Programs')
      : join(home, '.local', 'bin');
  } else {
    // Unix: ~/.local/bin (standard user bin directory)
    return join(home, '.local', 'bin');
  }
}

// Get system bin directory for symlink (requires elevated permissions)
function getSystemBinDir(): string {
  if (process.platform === 'win32') {
    return process.env.SystemRoot
      ? join(process.env.SystemRoot, 'System32')
      : 'C:\\Windows\\System32';
  } else {
    return '/usr/local/bin';
  }
}

// Check if a directory is in PATH
function isInPath(dir: string): boolean {
  const pathEnv = process.env.PATH || '';
  const separator = process.platform === 'win32' ? ';' : ':';
  const paths = pathEnv.split(separator).map((p) => p.toLowerCase());
  return paths.includes(dir.toLowerCase());
}

// Get link name based on platform
function getLinkName(): string {
  return process.platform === 'win32' ? 'ask-me.exe' : 'ask-me';
}

// Get symlink path (prefers user local bin, falls back to system bin)
function getSymlinkPath(): string {
  const linkName = getLinkName();
  const userBinDir = getUserLocalBinDir();
  const systemBinDir = getSystemBinDir();

  // Check if user local bin is in PATH and prefer it
  if (isInPath(userBinDir)) {
    return join(userBinDir, linkName);
  }

  // Fall back to system bin
  return join(systemBinDir, linkName);
}

// Get the best bin directory for installation
function getBestBinDir(): { dir: string; isUserLocal: boolean; needsPathUpdate: boolean } {
  const userBinDir = getUserLocalBinDir();
  const systemBinDir = getSystemBinDir();

  // Prefer user local bin (no sudo needed)
  const userLocalInPath = isInPath(userBinDir);

  return {
    dir: userBinDir,
    isUserLocal: true,
    needsPathUpdate: !userLocalInPath,
  };
}

// Check if symlink exists (regardless of whether target is valid)
function symlinkExists(linkPath: string): boolean {
  try {
    // lstatSync checks the link itself, not the target
    const stats = lstatSync(linkPath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

// Check if symlink exists and points to given target (and target exists)
function isSymlinkPointingTo(linkPath: string, targetPath: string): boolean {
  try {
    if (!symlinkExists(linkPath)) {
      return false;
    }

    const linkTarget = readlinkSync(linkPath);
    const normalizedTarget = resolve(linkTarget).toLowerCase();
    const normalizedExpected = resolve(targetPath).toLowerCase();

    // Also verify target exists
    if (!existsSync(targetPath)) {
      return false;
    }

    return normalizedTarget === normalizedExpected;
  } catch {
    return false;
  }
}

// Check if symlink is broken (exists but target doesn't)
function isSymlinkBroken(linkPath: string): boolean {
  try {
    if (!symlinkExists(linkPath)) {
      return false;
    }
    // existsSync follows symlinks - if link exists but this returns false, target is missing
    return !existsSync(linkPath);
  } catch {
    return false;
  }
}

// Create symlink to bin directory (prefers user local bin)
async function createSymlinkToBin(executablePath: string): Promise<{
  success: boolean;
  skipped: boolean;
  linkPath: string;
  needsPathUpdate: boolean;
  message: string;
}> {
  const absoluteExePath = resolve(executablePath);
  const { dir: binDir, needsPathUpdate } = getBestBinDir();
  const linkName = getLinkName();
  const linkPath = join(binDir, linkName);

  if (!existsSync(absoluteExePath)) {
    return {
      success: false,
      skipped: false,
      linkPath: '',
      needsPathUpdate: false,
      message: `Executable not found: ${absoluteExePath}`,
    };
  }

  // Check if symlink already points to current executable
  if (isSymlinkPointingTo(linkPath, absoluteExePath)) {
    return {
      success: true,
      skipped: true,
      linkPath,
      needsPathUpdate,
      message: `Already installed: ${linkPath} -> ${absoluteExePath}`,
    };
  }

  try {
    // Ensure bin directory exists
    if (!existsSync(binDir)) {
      mkdirSync(binDir, { recursive: true });
    }

    // Remove existing symlink if present (including broken symlinks)
    // Use symlinkExists() instead of existsSync() to detect broken symlinks
    if (symlinkExists(linkPath) || existsSync(linkPath)) {
      const { unlink } = await import('fs/promises');
      await unlink(linkPath);
    }

    // Create symlink
    const { symlink } = await import('fs/promises');

    if (process.platform === 'win32') {
      await symlink(absoluteExePath, linkPath, 'file');
    } else {
      await symlink(absoluteExePath, linkPath);
    }

    return {
      success: true,
      skipped: false,
      linkPath,
      needsPathUpdate,
      message: `Created symlink: ${linkPath} -> ${absoluteExePath}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes('EPERM') || msg.includes('EACCES') || msg.includes('permission')) {
      return {
        success: false,
        skipped: false,
        linkPath,
        needsPathUpdate,
        message: `Permission denied for ${binDir}`,
      };
    }

    return {
      success: false,
      skipped: false,
      linkPath,
      needsPathUpdate,
      message: `Failed to create symlink: ${msg}`,
    };
  }
}

// Generate hooks configuration
function generateHooksConfig(): any {
  const hookCommand = { command: 'ask-me hooks' };
  return {
    version: 1,
    hooks: {
      beforeShellExecution: [hookCommand],
      afterShellExecution: [hookCommand],
      beforeMCPExecution: [hookCommand],
      afterMCPExecution: [hookCommand],
      beforeReadFile: [hookCommand],
      afterFileEdit: [hookCommand],
      beforeSubmitPrompt: [hookCommand],
      afterAgentThought: [hookCommand],
      afterAgentResponse: [hookCommand],
    },
  };
}

// Merge hooks configuration (ask-me hooks go first)
function mergeHooksConfig(existing: any, askMeConfig: any): any {
  const merged = { version: 1, hooks: {} };

  // 合并每个 hook 事件（所有 ask-me 支持的 hooks）
  const hookEvents = [
    'beforeShellExecution',
    'afterShellExecution',
    'beforeMCPExecution',
    'afterMCPExecution',
    'beforeReadFile',
    'afterFileEdit',
    'beforeSubmitPrompt',
    'afterAgentThought',
    'afterAgentResponse',
  ];

  for (const event of hookEvents) {
    const existingHooks = existing.hooks?.[event] || [];
    const askMeHooks = askMeConfig.hooks?.[event] || [];

    // ask-me 的 hooks 放在最前面，然后是现有的 hooks
    merged.hooks[event] = [...askMeHooks, ...existingHooks];
  }

  return merged;
}

// 项目级安装（默认）
async function installProjectLevelHooks(targetDir: string): Promise<void> {
  const hooksDir = join(targetDir, '.cursor');
  const hooksFile = join(hooksDir, 'hooks.json');

  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // 读取现有配置（如果存在）
  let existingConfig: any = { version: 1, hooks: {} };
  if (existsSync(hooksFile)) {
    try {
      existingConfig = JSON.parse(readFileSync(hooksFile, 'utf-8'));
    } catch {
      // 解析失败，使用默认配置
    }
  }

  // 融合配置（ask-me 的 hooks 放在最前面）
  const mergedConfig = mergeHooksConfig(existingConfig, generateHooksConfig());
  writeFileSync(hooksFile, JSON.stringify(mergedConfig, null, 2), 'utf-8');

  console.log(`  ${chalk.green('✓')} Installed project hooks: ${hooksFile}`);
  console.log(`  ${chalk.dim('  → Scope: Project level (follows project)')}`);
}

// 用户级安装
async function installUserLevelHooks(): Promise<void> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const hooksDir = join(homeDir, '.cursor');
  const hooksFile = join(hooksDir, 'hooks.json');

  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // 读取现有配置（如果存在）
  let existingConfig: any = { version: 1, hooks: {} };
  if (existsSync(hooksFile)) {
    try {
      existingConfig = JSON.parse(readFileSync(hooksFile, 'utf-8'));
    } catch {
      // 解析失败，使用默认配置
    }
  }

  // 融合配置（ask-me 的 hooks 放在最前面）
  const mergedConfig = mergeHooksConfig(existingConfig, generateHooksConfig());
  writeFileSync(hooksFile, JSON.stringify(mergedConfig, null, 2), 'utf-8');

  console.log(`  ${chalk.green('✓')} Installed user hooks: ${hooksFile}`);
  console.log(`  ${chalk.dim('  → Scope: User level (all projects)')}`);
}

// Handle init command - install Cursor rules to project
export async function handleInitCommand(command: InitCommand): Promise<void> {
  const rulesDir = join(command.targetDir, '.cursor', 'rules');
  const targetPath = join(rulesDir, 'ask-me.mdc');

  console.log('');
  console.log(chalk.bold('Initializing ask-me Cursor rules and hooks...'));
  console.log('');

  // 1. 安装 MDC 规则文件
  const latestContent = getAskMeMdcContent();

  // Check if file exists and compare content
  if (existsSync(targetPath)) {
    const existingContent = readFileSync(targetPath, 'utf-8');

    if (existingContent === latestContent) {
      console.log(`  ${chalk.green('✓')} MDC rules up to date: ${targetPath}`);
    } else {
      // Content differs - update the file
      console.log(`  ${chalk.yellow('↻')} Updating outdated MDC rules...`);
      writeFileSync(targetPath, latestContent, 'utf-8');
      console.log(`  ${chalk.green('✓')} Updated MDC rules: ${targetPath}`);
    }
  } else {
    try {
      // Create directory if needed
      if (!existsSync(rulesDir)) {
        mkdirSync(rulesDir, { recursive: true });
      }

      // Write the rules file
      writeFileSync(targetPath, latestContent, 'utf-8');
      console.log(`  ${chalk.green('✓')} Created MDC rules: ${targetPath}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ${chalk.red('✗')} Failed to create MDC rules: ${msg}`);
    }
  }

  // 2. 安装 hooks（除非跳过）
  if (!command.skipHooks && command.hooksScope !== 'none') {
    try {
      if (command.hooksScope === 'user') {
        await installUserLevelHooks();
      } else {
        await installProjectLevelHooks(command.targetDir);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ${chalk.red('✗')} Failed to install hooks: ${msg}`);
    }
  }

  // 3. 显示完成信息
  console.log('');
  console.log(`${chalk.green('✓')} Initialization complete!`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Use ${chalk.cyan('ask-me pause')} to pause the AI agent`);
  console.log(`  2. Use ${chalk.cyan('ask-me resume')} to continue`);
  console.log(`  3. Run ${chalk.cyan('ask-me')} to start a session`);
  console.log('');
}

// Silent install - try to install without any output
// Called automatically on every command to ensure CLI is in PATH
export async function trySilentInstall(): Promise<void> {
  // Only for compiled binary
  if (!isCompiledBinary()) {
    return;
  }

  const executablePath = getCurrentExecutable();
  const absoluteExePath = resolve(executablePath);
  const { dir: binDir } = getBestBinDir();
  const linkPath = join(binDir, getLinkName());

  // Skip if already correctly installed
  if (isSymlinkPointingTo(linkPath, absoluteExePath)) {
    return;
  }

  // Try to create symlink silently to user local bin
  try {
    // Ensure bin directory exists
    if (!existsSync(binDir)) {
      mkdirSync(binDir, { recursive: true });
    }

    // Remove existing symlink if present (including broken symlinks)
    if (symlinkExists(linkPath) || existsSync(linkPath)) {
      const { unlink } = await import('fs/promises');
      await unlink(linkPath);
    }

    const { symlink } = await import('fs/promises');
    if (process.platform === 'win32') {
      await symlink(absoluteExePath, linkPath, 'file');
    } else {
      await symlink(absoluteExePath, linkPath);
    }
  } catch {
    // Silently ignore errors (permission denied, etc.)
  }
}

// Handle install command - install CLI to user local bin
export async function handleInstallCommand(): Promise<void> {
  console.log('');
  console.log(chalk.bold('Installing ask-me CLI...'));
  console.log('');

  // Check if compiled binary
  if (!isCompiledBinary()) {
    console.log(`  ${chalk.yellow('⊘')} Skipped: Only available for compiled binary.`);
    console.log('');
    console.log('  To compile and install:');
    console.log('');
    if (process.platform === 'win32') {
      console.log(`    1. Compile: ${chalk.cyan('bun run compile:windows')}`);
      console.log(`    2. Run: ${chalk.cyan('.\\dist\\windows-x64\\ask-me.exe install')}`);
    } else if (process.platform === 'darwin') {
      console.log(`    1. Compile: ${chalk.cyan('bun run compile:macos')}`);
      console.log(`    2. Run: ${chalk.cyan('./dist/macos-x64/ask-me install')}`);
    } else {
      console.log(`    1. Compile: ${chalk.cyan('bun run compile:linux')}`);
      console.log(`    2. Run: ${chalk.cyan('./dist/linux-x64/ask-me install')}`);
    }
    console.log('');
    return;
  }

  // Get current executable path
  const executablePath = getCurrentExecutable();

  // Create symlinks for both ask-me and ask
  const results = [];

  // Create ask-me symlink
  const resultAskMe = await createSymlinkToBin(executablePath);
  results.push({ name: 'ask-me', ...resultAskMe });

  // Create ask symlink
  const absoluteExePath = resolve(executablePath);
  const { dir: binDir, needsPathUpdate } = getBestBinDir();
  const askLinkName = process.platform === 'win32' ? 'ask.exe' : 'ask';
  const askLinkPath = join(binDir, askLinkName);

  // Check if ask symlink exists and points to current executable
  if (!isSymlinkPointingTo(askLinkPath, absoluteExePath)) {
    try {
      // Ensure bin directory exists
      if (!existsSync(binDir)) {
        mkdirSync(binDir, { recursive: true });
      }

      // Remove existing ask symlink if present
      if (symlinkExists(askLinkPath) || existsSync(askLinkPath)) {
        const { unlink } = await import('fs/promises');
        await unlink(askLinkPath);
      }

      // Create ask symlink
      const { symlink } = await import('fs/promises');
      if (process.platform === 'win32') {
        await symlink(absoluteExePath, askLinkPath, 'file');
      } else {
        await symlink(absoluteExePath, askLinkPath);
      }

      results.push({
        name: 'ask',
        success: true,
        skipped: false,
        linkPath: askLinkPath,
        needsPathUpdate,
        message: `Created symlink: ${askLinkPath} -> ${absoluteExePath}`,
      });
    } catch (error) {
      results.push({
        name: 'ask',
        success: false,
        skipped: false,
        linkPath: askLinkPath,
        needsPathUpdate,
        message: `Failed to create symlink: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  } else {
    results.push({
      name: 'ask',
      success: true,
      skipped: true,
      linkPath: askLinkPath,
      needsPathUpdate,
      message: `Already installed: ${askLinkPath} -> ${absoluteExePath}`,
    });
  }

  // Display results
  let allSuccess = true;
  for (const result of results) {
    if (result.success) {
      console.log(`  ${chalk.green('✓')} [${result.name}] ${result.message}`);
    } else {
      console.log(`  ${chalk.red('✗')} [${result.name}] ${result.message}`);
      allSuccess = false;
    }
  }
  console.log('');

  if (allSuccess) {
    // Check if PATH update is needed
    const needsPath = results.some((r) => r.needsPathUpdate && !r.skipped);

    if (needsPath) {
      const userBinDir = getUserLocalBinDir();
      console.log(`  ${chalk.yellow('⚠')} ${userBinDir} is not in your PATH.`);
      console.log('');
      console.log('  Add it to your shell profile:');
      console.log('');

      if (process.platform === 'darwin') {
        // Check if already exists before adding (avoid duplicates)
        console.log(
          `    ${chalk.cyan(`grep -q '.local/bin' ~/.zshrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc`)}`
        );
        console.log(`    ${chalk.cyan('source ~/.zshrc')}`);
      } else if (process.platform === 'linux') {
        // Check if already exists before adding (avoid duplicates)
        console.log(
          `    ${chalk.cyan(`grep -q '.local/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc`)}`
        );
        console.log(`    ${chalk.cyan('source ~/.bashrc')}`);
      } else {
        // Windows - add to user PATH via PowerShell (check if exists first to avoid duplicates)
        console.log(
          `    ${chalk.cyan(`$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")`)}`
        );
        console.log(
          `    ${chalk.cyan(`if (-not $userPath.Contains("${userBinDir.replace(/\\/g, '\\\\')}")) {`)}`
        );
        console.log(
          `    ${chalk.cyan(`  [Environment]::SetEnvironmentVariable("PATH", "$userPath;${userBinDir}", "User")`)}`
        );
        console.log(`    ${chalk.cyan('}')}`);
        console.log('');
        console.log(`    ${chalk.dim('Then restart your terminal to apply changes.')}`);
      }
      console.log('');
    }

    // Show success message with both commands
    if (!needsPath || results.some((r) => r.skipped)) {
      console.log(chalk.green.bold('  Successfully installed!'));
      console.log('');
      console.log('  You can now use either command:');
      console.log(`    ${chalk.cyan('ask-me')}  ${chalk.dim('(full name)')}`);
      console.log(`    ${chalk.cyan('ask')}     ${chalk.dim('(short alias)')}`);
      console.log('');
      console.log(`  Examples:`);
      console.log(
        `    ${chalk.dim('$')} ${chalk.cyan('ask-me')} ${chalk.dim('--cwd=/path/to/project --title="Task done"')}`
      );
      console.log(
        `    ${chalk.dim('$')} ${chalk.cyan('ask')} ${chalk.dim('--title="Quick update"')}`
      );
      console.log('');
    }
  } else {
    // Show manual instructions for failed installations
    const userBinDir = getUserLocalBinDir();
    const linkName = getLinkName();
    const absolutePath = resolve(executablePath);

    console.log('  Manual installation:');
    console.log('');
    console.log(`    ${chalk.cyan(`mkdir -p "${userBinDir}"`)}`);
    console.log(`    ${chalk.cyan(`ln -sf "${absolutePath}" "${join(userBinDir, linkName)}"`)}`);
    console.log(`    ${chalk.cyan(`ln -sf "${absolutePath}" "${join(userBinDir, 'ask')}"`)}`);
    console.log('');

    if (process.platform !== 'win32') {
      console.log('  Then add to PATH (if not already):');
      console.log('');
      const rcFile = process.platform === 'darwin' ? 'zshrc' : 'bashrc';
      console.log(
        `    ${chalk.cyan(`grep -q '.local/bin' ~/.${rcFile} || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.${rcFile}`)}`
      );
      console.log('');
    }
  }
}
