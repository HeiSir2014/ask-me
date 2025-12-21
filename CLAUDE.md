# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ask-Me CLI is an interactive prompt tool that enables continuous work loops for Cursor AI. It bridges Cursor AI agents with user input through spawned editor sessions, supporting 15+ editors and cross-platform compilation.

**Runtime**: Bun (TypeScript)
**Key Dependencies**: Commander.js (CLI), Chalk (terminal colors), Zod (validation)

## Common Commands

```bash
# Development
bun install              # Install dependencies
bun run start            # Run development version
bun run dev              # Same as start
bun run format           # Format code with Prettier

# Building
bun run build            # Build for Bun runtime
bun run compile          # Compile for current platform
bun run compile:all      # Compile for all platforms (Windows, Linux, macOS x64/arm64)

# Testing
bun test                 # Run test suite (uses Bun's built-in test runner)
```

## Architecture

### Entry Point and Command Flow

- [src/index.ts](src/index.ts) - CLI entry point with shebang for direct execution
- [src/cli.ts](src/cli.ts) - Commander.js argument parsing and command routing
- [src/commands/](src/commands/) - Individual command handlers (main, editor, init, install, config, history, pause, hooks)

### Core Modules

- [src/config.ts](src/config.ts) - Settings management (`~/.ask-me/settings.json`) with Zod validation
- [src/file-manager.ts](src/file-manager.ts) - File I/O with pessimistic locking (30s timeout, 100ms retry)
- [src/editor.ts](src/editor.ts) - Editor spawning with timeout handling (default 4 min)
- [src/template.ts](src/template.ts) - Markdown session template generation
- [src/editors/presets.ts](src/editors/presets.ts) - 15 editor definitions with platform-specific commands
- [src/utils/](src/utils/) - Shared utilities (datetime, path normalization, common helpers)
- [src/commands/hooks.ts](src/commands/hooks.ts) - Cursor hooks integration for pause/resume control
- [src/commands/pause.ts](src/commands/pause.ts) - Pause/resume command handlers with audit logging

### Build System

- [scripts/build.ts](scripts/build.ts) - Embeds `ask-me.mdc` content at compile time into `src/assets/embedded-content.ts`
- Uses Bun's native binary compilation for cross-platform executables

### Session Storage

- Sessions stored in `~/.ask-me/projects/{normalized-cwd}/latest.md`
- CWD paths normalized to safe directory names (e.g., `/Users/name/project` → `users-name-project`)
- Old sessions auto-archived by date

### Hooks Integration Architecture

- **Hooks Handler** (`src/commands/hooks.ts`) - Processes 9 Cursor hook events
  - Reads stdin JSON from Cursor with `hook_event_name` field
  - Before hooks check pause status and return permission (allow/deny)
  - After hooks record audit logs to `~/.ask-me/projects/{project}/{date}/hooks-audit.jsonl`
  - `beforeSubmitPrompt` automatically clears pause signal

- **Hooks Installation** (`src/commands/install.ts`) - Smart config merging
  - Supports project-level (`.cursor/hooks.json`) and user-level (`~/.cursor/hooks.json`)
  - Preserves existing hooks, adds ask-me hooks with highest priority
  - Generates configuration for all 9 supported hook events

- **Pause/Resume** (`src/commands/pause.ts`) - Signal file management
  - Creates `.cursor/.pause-signal` file on pause
  - Stores metadata to `~/.ask-me/projects/{project}/{date}/pause-data.json`
  - Auto-cleanup on resume or user input

### Audit System

- **Hook Events**: All 9 events logged with timestamp, conversation_id, generation_id, model, etc.
- **Pause Tracking**: Records who paused, when, why, and from which context
- **Storage**: Centralized in `~/.ask-me/projects/{normalized-cwd}/{date}/` for easy management
- **Date Format**: Uses local timezone (YYYY-MM-DD) for proper date boundaries

## Key Design Decisions

1. **All commands exit with code 0** - Required for Cursor AI integration (Cursor checks stdout, not exit code)
2. **File locking** - Prevents concurrent session writes during fast agent loops
3. **Timeout vs quick close distinction** - Timeout outputs to stderr, valid input to stdout
4. **Embedded MDC rules** - Build-time embedding prevents external file dependencies in compiled binaries

## Cursor Rules (ask-me.mdc)

The [src/assets/ask-me.mdc](src/assets/ask-me.mdc) file defines Cursor agent behavior. Key points:

- Agents must ALWAYS call `ask-me` after completing work, never wait for chat input
- Title format: `LABEL: <action summary>` (DONE, CHOOSE, CONFIRM, BLOCKED, ERROR, INFO, READY, ANALYSIS, PAUSED)
- Context must include structured YAML with task analysis, changes, impact, and suggestions
- Dangerous operations (delete >1 file, large refactoring, dependency changes) require CONFIRM before execution

### Pause Mechanism

The pause feature uses Cursor's native hooks system for reliable, event-driven control:

**Check Points** (before hooks):

1. Before shell execution
2. Before MCP tool execution
3. Before file read

**Audit Points** (after hooks):

1. After shell execution
2. After MCP execution
3. After file edit
4. After agent thought
5. After agent response

**Flow**:

1. User runs `ask-me pause` → creates `.cursor/.pause-signal`
2. Hooks detect pause signal → AI receives deny permission
3. AI stops and calls `ask-me` with PAUSED status
4. User provides input
5. `beforeSubmitPrompt` hook auto-clears pause signal
6. AI resumes execution

**Key Features**:

- Event-driven (no polling required)
- Precise control (pause before specific operations)
- Self-call detection (ask-me commands bypass pause check)
- Audit logging (all events tracked with conversation_id/generation_id)
- Smart config merging (preserves existing hooks, adds priority)
