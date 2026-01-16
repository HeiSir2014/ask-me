import chalk from 'chalk';
import { Command } from 'commander';
import type { CLICommand, CLIOptions, HistoryCommand, PauseCommand, MuteCommand } from './types.ts';
import { getPresetNames } from './editors/presets.ts';
import pkg from '../package.json';

// Package version from package.json
const VERSION = pkg.version;

// Result holder for parsed command
let parsedCommand: CLICommand | null = null;

// Custom help formatter
function formatHelp(cmd: Command): string {
  const name = cmd.name();
  const args = cmd.usage() || '';

  let output = '\n';
  output += `${chalk.bold('Usage:')} ${name} ${chalk.dim(args)}\n`;
  output += '\n';
  output += `${cmd.description()}\n`;

  const options = cmd.options;
  if (options.length > 0) {
    output += '\n';
    output += `${chalk.bold('Options:')}\n`;
    for (const opt of options) {
      const flags = opt.flags
        .split(', ')
        .map((f) => chalk.cyan(f))
        .join(', ');
      output += `  ${flags}  ${opt.description}\n`;
    }
  }

  const commands = cmd.commands;
  if (commands.length > 0) {
    output += '\n';
    output += `${chalk.bold('Commands:')}\n`;
    for (const sub of commands) {
      const subName = chalk.cyan(sub.name());
      const subArgs = sub.usage() ? ` ${chalk.dim(sub.usage())}` : '';
      output += `  ${subName}${subArgs}  ${sub.description()}\n`;
    }
  }

  // Add pause/mute usage hint for main help
  if (name === 'ask-me') {
    output += '\n';
    output += `${chalk.bold('Pause/Resume (per-project):')}\n`;
    output += `  ${chalk.cyan('ask-me pause')}   Stop AI agent immediately (create .cursor/.pause-signal)\n`;
    output += `  ${chalk.cyan('ask-me resume')}  Continue AI agent (remove .cursor/.pause-signal)\n`;
    output += `  ${chalk.dim('Note: AI agent checks .cursor/.pause-signal before each operation')}\n`;
    output += '\n';
    output += `${chalk.bold('Mute/Unmute (global):')}\n`;
    output += `  ${chalk.cyan('ask-me mute')}    Skip editor, auto-output "continue" after timeout\n`;
    output += `  ${chalk.cyan('ask-me unmute')}  Restore normal editor behavior\n`;
    output += `  ${chalk.dim('Note: Mute affects ALL projects globally')}\n`;
  }

  output += '\n';
  return output;
}

// Create the program with action handlers
function createProgram(): Command {
  const program = new Command();

  program
    .name('ask-me')
    .description('Interactive prompt tool for AI agents - continuous work loop')
    .version(
      `${chalk.bold('ask-me')} ${chalk.cyan(VERSION)}`,
      '-v, --version',
      'Output the version number'
    )
    .helpOption('-h, --help', 'Display help for command')
    .configureHelp({
      formatHelp: (cmd) => formatHelp(cmd),
    })
    .helpCommand('help [command]', 'Display help for command');

  // Main command options (all optional with defaults)
  program
    .option('--cwd <path>', 'Working directory path', process.cwd())
    .option('--title <title>', 'Session title', '')
    .option('--context <text>', 'Additional context to display')
    .action((opts) => {
      parsedCommand = {
        type: 'main',
        options: {
          cwd: opts.cwd || process.cwd(),
          title: opts.title || '',
          context: opts.context,
        },
      };
    });

  // Editor subcommand help formatter
  const editorHelpFormatter = () => {
    let output = '\n';
    output += `${chalk.bold('Usage:')} ask-me editor ${chalk.cyan('<command>')}\n`;
    output += '\n';
    output += 'Manage editor configuration\n';
    output += '\n';
    output += `${chalk.bold('Commands:')}\n`;
    output += `  ${chalk.cyan('list')}            List all available editors\n`;
    output += `  ${chalk.cyan('current')}         Show current editor configuration\n`;
    output += `  ${chalk.cyan('use')} ${chalk.dim('<name>')}      Switch to a preset editor\n`;
    output += `  ${chalk.cyan('set')} ${chalk.dim('<command>')}   Set a custom editor command\n`;
    output += '\n';
    output += `${chalk.bold('Available editors:')} ${chalk.dim(getPresetNames().join(', '))}\n`;
    output += '\n';
    return output;
  };

  // Editor subcommand
  const editorCmd = program
    .command('editor')
    .description('Manage editor configuration')
    .configureHelp({ formatHelp: editorHelpFormatter })
    .action(() => {
      // No subcommand provided, show help and exit gracefully
      console.log(editorHelpFormatter());
      process.exit(0);
    });

  editorCmd
    .command('list')
    .description('List all available editors')
    .action(() => {
      parsedCommand = { type: 'editor', command: { subcommand: 'list' } };
    });

  editorCmd
    .command('current')
    .description('Show current editor configuration')
    .action(() => {
      parsedCommand = { type: 'editor', command: { subcommand: 'current' } };
    });

  editorCmd
    .command('use <name>')
    .description('Switch to a preset editor')
    .action((name) => {
      parsedCommand = { type: 'editor', command: { subcommand: 'use', value: name } };
    });

  editorCmd
    .command('set <command>')
    .description('Set a custom editor command')
    .action((command) => {
      parsedCommand = { type: 'editor', command: { subcommand: 'set', value: command } };
    });

  // Init subcommand (Cursor rules)
  program
    .command('init')
    .description('Initialize Cursor rules in current project')
    .option('--hooks <scope>', 'Install hooks (project|user|none)', 'project')
    .option('--no-hooks', 'Skip hooks installation')
    .action((opts) => {
      parsedCommand = {
        type: 'init',
        command: {
          targetDir: process.cwd(),
          hooksScope: opts.hooks,
          skipHooks: opts.noHooks,
        },
      };
    });

  // Install subcommand (CLI to system PATH)
  program
    .command('install')
    .description('Install CLI executable to system PATH')
    .action(() => {
      parsedCommand = { type: 'install' };
    });

  // Pause subcommand
  program
    .command('pause')
    .description('Pause Cursor AI agent (create .cursor/.pause-signal file)')
    .action(() => {
      parsedCommand = {
        type: 'pause',
        command: { targetDir: process.cwd() },
      };
    });

  // Resume subcommand
  program
    .command('resume')
    .description('Resume Cursor AI agent (remove .cursor/.pause-signal file)')
    .action(() => {
      parsedCommand = {
        type: 'resume',
        command: { targetDir: process.cwd() },
      };
    });

  // Mute subcommand (global)
  program
    .command('mute')
    .description('Enable global mute mode (skip editor, auto-continue after timeout)')
    .option('--status', 'Show current mute status')
    .action((opts) => {
      parsedCommand = {
        type: 'mute',
        command: { status: opts.status },
      };
    });

  // Unmute subcommand (global)
  program
    .command('unmute')
    .description('Disable global mute mode (restore normal editor behavior)')
    .action(() => {
      parsedCommand = { type: 'unmute' };
    });

  // Hooks subcommand
  program
    .command('hooks')
    .description('Integrate with Cursor hooks for pause/resume')
    .option('--status', 'Get current pause status (for user)')
    .configureHelp({
      formatHelp: () => {
        let output = '\n';
        output += `${chalk.bold('Usage:')} ask-me hooks ${chalk.dim('[options]')}\n`;
        output += '\n';
        output += 'Integrate with Cursor hooks for pause/resume control\n';
        output += '\n';
        output += `${chalk.bold('Options:')}\n`;
        output += `  ${chalk.cyan('--status')}  Get current pause status\n`;
        output += '\n';
        output += `${chalk.bold('How it works:')}\n`;
        output += `  When called without options, reads stdin JSON from Cursor hooks.\n`;
        output += `  Uses ${chalk.cyan('hook_event_name')} field to identify the event type.\n`;
        output += `  Before hooks check pause status, after hooks record audit logs.\n`;
        output += '\n';
        output += `${chalk.bold('Examples:')}\n`;
        output += `  ${chalk.dim('# Called by Cursor hooks (reads stdin):')}\n`;
        output += `  ask-me hooks\n`;
        output += '\n';
        output += `  ${chalk.dim('# Check status manually:')}\n`;
        output += `  ask-me hooks --status\n`;
        output += '\n';
        return output;
      },
    })
    .action((opts) => {
      parsedCommand = {
        type: 'hooks',
        command: {
          status: opts.status,
        },
      };
    });

  // Config subcommand
  program
    .command('config')
    .description('Edit settings in your default editor')
    .action(() => {
      parsedCommand = { type: 'config' };
    });

  // History subcommand
  program
    .command('history')
    .description('View session history')
    .option('-p, --project <name>', 'Show history for specific project')
    .option('-n, --limit <number>', 'Limit number of sessions to show', '10')
    .configureHelp({
      formatHelp: () => {
        let output = '\n';
        output += `${chalk.bold('Usage:')} ask-me history ${chalk.dim('[options]')}\n`;
        output += '\n';
        output += 'View session history\n';
        output += '\n';
        output += `${chalk.bold('Options:')}\n`;
        output += `  ${chalk.cyan('-p')}, ${chalk.cyan('--project')} ${chalk.dim('<name>')}  Show history for specific project\n`;
        output += `  ${chalk.cyan('-n')}, ${chalk.cyan('--limit')} ${chalk.dim('<number>')}  Limit number of sessions to show ${chalk.dim('(default: 10)')}\n`;
        output += `  ${chalk.cyan('-h')}, ${chalk.cyan('--help')}            Display help for command\n`;
        output += '\n';
        return output;
      },
    })
    .action((opts) => {
      const command: HistoryCommand = {
        project: opts.project,
        limit: parseInt(opts.limit || '10', 10),
      };
      parsedCommand = { type: 'history', command };
    });

  // Configure error handling
  program.exitOverride();
  program.configureOutput({
    writeErr: (str) => {
      // Colorize error output and improve messages
      let colorized = str
        .replace(/error:/gi, chalk.red('Error:'))
        .replace(/unknown command/gi, chalk.red('Unknown command'))
        .replace(/too many arguments/gi, chalk.red('Unknown command'));

      // Add help hint for errors
      if (str.includes('error:') || str.includes('Error:')) {
        colorized = '\n' + colorized;
        if (!str.includes('--help')) {
          colorized += `\nRun ${chalk.cyan('ask-me --help')} for usage.\n`;
        }
      }

      process.stderr.write(colorized);
    },
  });

  return program;
}

// Parse command line arguments
export function parseArgs(args: string[]): CLICommand {
  parsedCommand = null;

  const program = createProgram();

  try {
    program.parse(args, { from: 'user' });
  } catch (err: unknown) {
    // Commander throws on --help and --version, handle gracefully
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'commander.helpDisplayed' || code === 'commander.version') {
        process.exit(0);
      }
    }
    // For other errors, exit gracefully
    process.exit(0);
  }

  // If no command was set, default to main with defaults
  if (!parsedCommand) {
    return {
      type: 'main',
      options: {
        cwd: process.cwd(),
        title: '',
        context: undefined,
      },
    };
  }

  return parsedCommand;
}

// Show main help (for external use)
export function showHelp(): void {
  const program = createProgram();
  program.outputHelp();
}
