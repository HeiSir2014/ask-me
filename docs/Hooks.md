<!-- markdownlint-disable -->

# Hooks

Hooks 允许你通过自定义脚本来观察、控制和扩展 agent 循环。Hooks 是通过 stdio 使用 JSON 双向通信的派生进程。它们在 agent 循环中定义的各阶段之前或之后运行，可以观察、阻止或修改行为。

借助 hooks，你可以：

- 在编辑后运行代码格式化工具
- 为事件添加分析统计
- 扫描敏感个人信息（PII）或机密数据
- 为高风险操作加上门控（例如 SQL 写入）

## Agent 和 Tab 支持

Hooks 同时适用于 **Cursor Agent**（Cmd+K/Agent Chat）和 **Cursor Tab**（行内补全），但它们使用不同的 hook 事件：

**Agent（Cmd+K/Agent Chat）** 使用标准 hooks：

- `beforeShellExecution` / `afterShellExecution` - 控制 shell 命令执行
- `beforeMCPExecution` / `afterMCPExecution` - 控制 MCP 工具的使用
- `beforeReadFile` / `afterFileEdit` - 控制文件访问和编辑
- `beforeSubmitPrompt` - 在提交前校验 prompt
- `stop` - 处理 agent 结束
- `afterAgentResponse` / `afterAgentThought` - 跟踪 agent 的响应

**Tab（行内补全）** 使用专用 hooks：

- `beforeTabFileRead` - 控制用于 Tab 补全的文件访问
- `afterTabFileEdit` - 对 Tab 编辑结果进行后处理

这些独立的 hooks 使得可以对自主的 Tab 操作与用户驱动的 Agent 操作采用不同策略。

## 快速入门

创建一个 `hooks.json` 文件。你可以在项目级（`<project>/.cursor/hooks.json`）创建它，也可以在用户主目录（`~/.cursor/hooks.json`）中创建它。项目级的 hook 只对该项目生效，而主目录中的 hook 会在全局生效。

```
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [{ "command": "./hooks/format.sh" }]
  }
}
```

在 `~/.cursor/hooks/format.sh` 创建你的钩子脚本：

```
#!/bin/bash
# 读取输入，执行某些操作，退出码 0
cat > /dev/null
exit 0
```

设为可执行：

```
chmod +x ~/.cursor/hooks/format.sh
```

重启 Cursor。现在，每次编辑文件后，都会运行你的 hook。

## 示例

hooks.jsonaudit.shblock-git.sh```
{
"version": 1,
"hooks": {
"beforeShellExecution": [
{
"command": "./hooks/audit.sh"
},
{
"command": "./hooks/block-git.sh"
}
],
"beforeMCPExecution": [
{
"command": "./hooks/audit.sh"
}
],
"afterShellExecution": [
{
"command": "./hooks/audit.sh"
}
],
"afterMCPExecution": [
{
"command": "./hooks/audit.sh"
}
],
"afterFileEdit": [
{
"command": "./hooks/audit.sh"
}
],
"beforeSubmitPrompt": [
{
"command": "./hooks/audit.sh"
}
],
"stop": [
{
"command": "./hooks/audit.sh"
}
],
"beforeTabFileRead": [
{
"command": "./hooks/redact-secrets-tab.sh"
}
],
"afterTabFileEdit": [
{
"command": "./hooks/format-tab.sh"
}
]
}
}

```

## 配置

在 `hooks.json` 文件中定义 hooks。配置可存在于多个层级；高优先级的配置会覆盖低优先级的配置：

```

~/.cursor/
├── hooks.json
└── hooks/
├── audit.sh
└── block-git.sh

```

- **全局**（企业统一管理）：
- macOS: `/Library/Application Support/Cursor/hooks.json`
- Linux/WSL: `/etc/cursor/hooks.json`
- Windows: `C:\\ProgramData\\Cursor\\hooks.json`
- **项目目录**（项目级）：
- `<project-root>/.cursor/hooks.json`
- 项目 hooks 会在任意受信任的工作区中执行，并随项目一同纳入版本控制
- **用户主目录**（用户级）：
- `~/.cursor/hooks.json`

优先级顺序（从高到低）：企业 → 项目 → 用户

`hooks` 对象会将 hook 名称映射到由 hook 定义组成的数组。每个定义目前支持一个 `command` 属性，可以是 shell 字符串、绝对路径，或相对于 `hooks.json` 文件的路径。

### 配置文件

```

{
"version": 1,
"hooks": {
"beforeShellExecution": [{ "command": "./script.sh" }],
"afterShellExecution": [{ "command": "./script.sh" }],
"afterMCPExecution": [{ "command": "./script.sh" }],
"afterFileEdit": [{ "command": "./format.sh" }],
"beforeTabFileRead": [{ "command": "./redact-secrets-tab.sh" }],
"afterTabFileEdit": [{ "command": "./format-tab.sh" }]
}
}

```

Agent 钩子（`beforeShellExecution`、`afterShellExecution`、`beforeMCPExecution`、`afterMCPExecution`、`beforeReadFile`、`afterFileEdit`、`beforeSubmitPrompt`、`stop`、`afterAgentResponse`、`afterAgentThought`）适用于 Cmd+K 和 Agent Chat 操作。Tab 钩子（`beforeTabFileRead`、`afterTabFileEdit`）仅适用于内联 Tab 补全。

## 团队分发

可以通过项目 Hook（借助版本控制）、MDM 工具或 Cursor 的云分发系统，将 Hook 分发给团队成员。

### 项目 Hook（版本控制）

项目 hook 是在团队中共享 hook 的最简单方式。将一个 `hooks.json` 文件放在 `<project-root>/.cursor/hooks.json` 下，并将其提交到代码仓库。当团队成员在受信任的工作区中打开该项目时，Cursor 会自动加载并运行这些项目 hook。

项目 hook：

- 与代码一起存储在版本控制中
- 会在受信任的工作区中为所有团队成员自动加载
- 可以是针对特定项目的（例如，为特定代码库强制执行格式标准）
- 需要工作区被标记为受信任才能运行（出于安全考虑）

### MDM 分发

使用移动设备管理（MDM）工具在整个组织内分发 hooks。将 `hooks.json` 文件和 hook 脚本放置在每台机器的目标目录中。

**用户主目录**（按用户分发）：

- `~/.cursor/hooks.json`
- `~/.cursor/hooks/`（用于 hook 脚本）

**全局目录**（系统级分发）：

- macOS: `/Library/Application Support/Cursor/hooks.json`
- Linux/WSL: `/etc/cursor/hooks.json`
- Windows: `C:\\ProgramData\\Cursor\\hooks.json`

注意：基于 MDM 的分发由你们的组织全权管理。Cursor 不会通过你们的 MDM 解决方案部署或管理文件。请确保内部 IT 或安全团队根据组织策略负责配置、部署和更新。

### 云端分发（仅限企业版）

企业团队可以使用 Cursor 原生的云端分发功能，将 hooks 自动同步到所有团队成员的设备。可在 [Web 控制台](https://cursor.com/dashboard?tab=team-content&section=hooks) 中配置 hooks。团队成员登录时，Cursor 会自动将已配置的 hooks 分发到所有客户端设备。

云端分发提供：

- 自动同步到所有团队成员（每三十分钟一次）
- 按操作系统进行平台定向的 hooks 分发
- 通过控制台进行集中管理

企业管理员可以在控制台中创建、编辑和管理团队 hooks，而无需访问每台设备。

## 参考

### 通用 Schema

#### 输入（所有 hooks）

除各自特有的字段外，所有 hooks 还会接收一组通用基础字段：

```

{
"conversation_id": "string",
"generation_id": "string",
"model": "string",
"hook_event_name": "string",
"cursor_version": "string",
"workspace_roots": ["<path>"],
"user_email": "string | null"
}

```

FieldTypeDescription`conversation_id`string多轮对话中的稳定会话 ID`generation_id`string随每条用户消息变化的当前生成 ID`model`string触发该 hook 的 Composer 所配置的模型`hook_event_name`string正在运行的 hook 名称`cursor_version`stringCursor 应用版本（例如 "1.7.2"）`workspace_roots`string[]工作区根文件夹列表（通常只有一个，但多根工作区可以包含多个）`user_email`stringnull已认证用户的电子邮件地址（如果可用）
### 钩子事件

#### beforeShellExecution / beforeMCPExecution

在执行任何 shell 命令或 MCP 工具之前调用。返回权限决策结果。

```

// beforeShellExecution 输入
{
"command": "<完整的终端命令>",
"cwd": "<当前工作目录>"
}

// beforeMCPExecution 输入
{
"tool_name": "<工具名称>",
"tool_input": "<json 参数>"
}
// 加上以下其中之一：
{ "url": "<服务器 URL>" }
// 或：
{ "command": "<命令字符串>" }

// 输出
{
"permission": "allow" | "deny" | "ask",
"user_message": "<客户端中显示的消息>",
"agent_message": "<发送给 Agent 的消息>"
}

```

#### afterShellExecution

在 shell 命令执行后触发；可用于审计或从命令输出中收集指标。

```

// 输入
{
"command": "<完整终端命令>",
"output": "<完整终端输出>",
"duration": 1234
}

```

字段类型描述`command`string已执行的完整终端命令`output`string终端捕获的完整输出`duration`number执行该 shell 命令所花费的毫秒数（不包括等待审批时间）
#### afterMCPExecution

在 MCP 工具执行完成后触发；包含该工具的输入参数和完整的 JSON 结果。

```

// 输入
{
"tool_name": "<工具名称>",
"tool_input": "<json 参数>",
"result_json": "<工具结果 json>",
"duration": 1234
}

```

FieldTypeDescription`tool_name`string已执行的 MCP 工具名称`tool_input`string传递给该工具的 JSON 参数字符串`result_json`string工具响应的 JSON 字符串`duration`number执行 MCP 工具所耗时间（毫秒），不包含审批等待时间
#### afterFileEdit

在 Agent 编辑文件之后触发；可用于格式化工具或记录 Agent 编写的代码。

```

// 输入
{
"file_path": "<绝对路径>",
"edits": [{ "old_string": "<查找内容>", "new_string": "<替换内容>" }]
}

```

#### beforeTabFileRead

在 Tab（行内补全）读取文件之前被调用。可在 Tab 访问文件内容前启用脱敏或访问控制。

**与 `beforeReadFile` 的主要区别：**

- 只会被 Tab 触发，不会被 Agent 触发
- 不包含 `attachments` 字段（Tab 不使用提示附件）
- 适合对 Tab 的自动化操作应用不同的策略

```

// 输入
{
"file_path": "<绝对路径>",
"content": "<文件内容>"
}

// 输出
{
"permission": "allow" | "deny"
}

```

#### afterTabFileEdit

在 Tab（内联补全）编辑文件之后被调用。适用于对 Tab 写入的代码进行格式化或审计。

**与 `afterFileEdit` 的主要区别：**

- 仅由 Tab 触发，不会被 Agent 触发
- 包含详细的编辑信息：`range`、`old_line` 和 `new_line`，用于精确追踪编辑
- 适合对 Tab 编辑进行细粒度的格式化或分析

```

// 输入
{
"file_path": "<绝对路径>",
"edits": [
{
"old_string": "<搜索内容>",
"new_string": "<替换内容>",
"range": {
"start_line_number": 10,
"start_column": 5,
"end_line_number": 10,
"end_column": 20
},
"old_line": "<编辑前的行>",
"new_line": "<编辑后的行>"
}
]
}

// 输出
{
// 当前暂无输出字段
}

```

#### beforeSubmitPrompt

在用户点击发送后、向后端发起请求之前调用。可用于阻止提交。

```

// 输入
{
"prompt": "<用户提示内容>",
"attachments": [
{
"type": "file" | "rule",
"filePath": "<绝对路径>"
}
]
}

// 输出
{
"continue": true | false,
"user_message": "<拦截时显示给用户的消息>"
}

```

输出字段类型描述`continue`boolean是否允许继续提交该提示`user_message`string (optional)当提示被阻止时展示给用户的消息
#### afterAgentResponse

在 Agent 完成一条助手回复后被调用。

```

// 输入
{
"text": "<助手最终文本>"
}

```

#### afterAgentThought

在 agent 完成一个思考阶段后被调用。可用于观察 agent 的推理过程。

```

// 输入
{
"text": "<完整汇总的思考文本>",
"duration_ms": 5000
}

// 输出
{
// 暂不支持输出字段
}

```

字段类型说明`text`string已完成区块的完整聚合思考文本`duration_ms`number (optional)思考区块的持续时间（毫秒）
#### stop

在 agent 循环结束时被调用。可以选择自动提交后续用户消息以继续迭代。

```

// 输入
{
"status": "completed" | "aborted" | "error",
"loop_count": 0
}

```

```

// 输出
{
"followup_message": "<消息文本>"
}

```

- 可选的 `followup_message` 是一个字符串。当设置且非空时，Cursor 会自动将其作为下一条用户消息提交。这支持循环式流程（例如循环执行直到达到目标）。
- `loop_count` 字段表示在当前对话中 stop hook 已经触发了多少次自动后续消息（初始为 0）。为防止无限循环，系统会强制最多只允许 5 次自动后续消息。

## 故障排查

**如何确认 Hooks 已启用**

在 Cursor 设置中有一个 Hooks 选项卡，用于调试已配置和已执行的 hooks，同时还有一个 Hooks 输出通道用于查看错误。

**如果 hooks 无法正常工作**

- 重启 Cursor，确保 hooks 服务正在运行。
- 使用相对路径时，确保 hook 脚本路径是相对于 `hooks.json` 的。
```
