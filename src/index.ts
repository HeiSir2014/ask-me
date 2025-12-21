#!/usr/bin/env bun
import { parseArgs } from './cli.ts';
import { handleMainCommand } from './commands/main.ts';
import { handleEditorCommand } from './commands/editor.ts';
import { handleHistoryCommand } from './commands/history.ts';
import { handlePauseCommand, handleResumeCommand } from './commands/pause.ts';
import { handleConfigCommand } from './commands/config.ts';
import { handleInitCommand, handleInstallCommand, trySilentInstall } from './commands/install.ts';
import { handleHooksCommand } from './commands/hooks.ts';
import { checkFirstRun } from './first-run.ts';
import { EXIT_CODE } from './types.ts';

async function main() {
  try {
    // Try to install CLI to PATH silently (for compiled binary)
    await trySilentInstall();

    const command = parseArgs(process.argv.slice(2));

    // Check first run - show welcome for non-main commands
    const showWelcome = command.type !== 'main';
    await checkFirstRun(showWelcome);

    switch (command.type) {
      case 'main':
        await handleMainCommand(command.options);
        break;
      case 'editor':
        await handleEditorCommand(command.command);
        break;
      case 'init':
        await handleInitCommand(command.command);
        break;
      case 'install':
        await handleInstallCommand();
        break;
      case 'history':
        handleHistoryCommand(command.command);
        break;
      case 'pause':
        handlePauseCommand(command.command);
        break;
      case 'resume':
        handleResumeCommand(command.command);
        break;
      case 'hooks':
        handleHooksCommand(command.command);
        break;
      case 'config':
        await handleConfigCommand();
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
  }

  // Always exit with code 0 for Cursor compatibility
  process.exit(EXIT_CODE);
}

main();
