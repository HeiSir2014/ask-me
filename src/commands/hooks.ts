import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { HooksCommand, HookContext, HookOutput } from '../types.ts';
import { getTodayDate, getLocalTimestamp, normalizeCwdPath } from '../utils/index.ts';

// Hook 事件类型
type HookEventType =
  | 'beforeShellExecution'
  | 'afterShellExecution'
  | 'beforeMCPExecution'
  | 'afterMCPExecution'
  | 'beforeReadFile'
  | 'afterFileEdit'
  | 'beforeSubmitPrompt'
  | 'afterAgentThought'
  | 'afterAgentResponse'
  | 'stop';

// 需要检查暂停状态的 before hooks
const PAUSE_CHECK_HOOKS: HookEventType[] = [
  'beforeShellExecution',
  'beforeMCPExecution',
  'beforeReadFile',
];

// 需要审计追踪的 after hooks
const AUDIT_HOOKS: HookEventType[] = [
  'afterShellExecution',
  'afterMCPExecution',
  'afterFileEdit',
  'afterAgentThought',
  'afterAgentResponse',
];

export function handleHooksCommand(command: HooksCommand): void {
  // 用户手动检查状态
  if (command.status) {
    const cwd = process.cwd();
    const pauseSignalFile = join(cwd, '.cursor', '.pause-signal');
    const isPaused = existsSync(pauseSignalFile);
    console.log(isPaused ? 'paused' : 'running');
    return;
  }

  // 读取 stdin 的 JSON 数据（Cursor 传递的通用字段）
  let stdinData = '';
  let hookContext: Partial<HookContext> = {};
  try {
    stdinData = readFileSync(0, 'utf-8');
    if (stdinData) {
      hookContext = JSON.parse(stdinData);
    }
  } catch {
    // 读取失败，输出允许并退出
    console.log(JSON.stringify({ permission: 'allow' }));
    process.exit(0);
  }

  // 从 hook 上下文获取关键信息
  const workspaceRoots = hookContext.workspace_roots || [];
  const cwd = workspaceRoots[0] || process.cwd();
  const hookEventName = hookContext.hook_event_name as HookEventType;

  // 构建审计文件路径（使用统一的 ~/.ask-me/projects/{project}/ 目录）
  const today = getTodayDate();
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const normalizedProject = normalizeCwdPath(cwd);
  const auditDir = join(homeDir, '.ask-me', 'projects', normalizedProject, today);

  // 创建审计目录
  try {
    if (!existsSync(auditDir)) {
      mkdirSync(auditDir, { recursive: true });
    }
  } catch {
    // 忽略创建失败
  }

  const pauseSignalFile = join(cwd, '.cursor', '.pause-signal');
  const pauseDataFile = join(auditDir, 'pause-data.json');
  const auditLogFile = join(auditDir, 'hooks-audit.jsonl');

  // 记录审计日志（所有事件都记录）
  const auditRecord = {
    timestamp: getLocalTimestamp(),
    hook_event: hookEventName,
    conversation_id: hookContext.conversation_id,
    generation_id: hookContext.generation_id,
    model: hookContext.model,
    cursor_version: hookContext.cursor_version,
    // 事件特定字段
    command: hookContext.command,
    tool_name: hookContext.tool_name,
    file_path: hookContext.file_path,
    duration: hookContext.duration || hookContext.duration_ms,
  };

  try {
    appendFileSync(auditLogFile, JSON.stringify(auditRecord) + '\n');
  } catch {
    // 忽略审计日志写入失败
  }

  // 根据 hook_event_name 处理不同事件
  switch (hookEventName) {
    // === Before Hooks: 检查暂停状态 ===
    case 'beforeShellExecution':
    case 'beforeMCPExecution':
    case 'beforeReadFile':
      handlePauseCheck(hookContext, pauseSignalFile, pauseDataFile);
      break;

    // === beforeSubmitPrompt: 用户提交时清理暂停信号 ===
    case 'beforeSubmitPrompt':
      handleSubmitPrompt(pauseSignalFile, pauseDataFile);
      break;

    // === After Hooks: 仅追踪，不阻塞 ===
    case 'afterShellExecution':
    case 'afterMCPExecution':
    case 'afterFileEdit':
    case 'afterAgentThought':
    case 'afterAgentResponse':
    case 'stop':
      // 已通过审计日志记录，直接退出
      process.exit(0);
      break;

    default:
      // 未知事件，允许通过
      console.log(JSON.stringify({ permission: 'allow' }));
      process.exit(0);
  }
}

// 处理暂停检查（before hooks）
function handlePauseCheck(
  hookContext: Partial<HookContext>,
  pauseSignalFile: string,
  pauseDataFile: string
): void {
  const commandStr = hookContext.command || '';
  const toolName = hookContext.tool_name || '';
  const filePath = hookContext.file_path || '';
  const hookEventName = hookContext.hook_event_name || '';

  // 判断是否是 ask-me 自身的调用
  const isAskMeCommand = commandStr.includes('ask-me') || commandStr.includes('ask ');

  // 如果是 ask-me 自身调用，永远允许执行
  if (isAskMeCommand) {
    console.log(JSON.stringify({ permission: 'allow' }));
    process.exit(0);
  }

  // 检查外部暂停信号
  if (existsSync(pauseSignalFile)) {
    // 输出拒绝，阻止执行
    const output: HookOutput = {
      permission: 'deny',
      user_message: '⏸️ Agent 已暂停，等待用户指令...',
      agent_message: `用户已暂停执行（${hookEventName}）。请调用 ask-me 等待用户输入后再继续。`,
    };
    console.log(JSON.stringify(output));
    process.exit(0);
  }

  // 未暂停，允许执行
  console.log(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
}

// 处理用户提交（清理暂停信号）
function handleSubmitPrompt(pauseSignalFile: string, pauseDataFile: string): void {
  // 用户主动提交说明要继续，清理暂停信号
  try {
    if (existsSync(pauseSignalFile)) {
      unlinkSync(pauseSignalFile);
    }
    if (existsSync(pauseDataFile)) {
      unlinkSync(pauseDataFile);
    }
  } catch {
    // 忽略清理失败
  }

  // 允许继续提交
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}
