<!-- markdownlint-disable -->

# Ask-Me CLI

一个为 Cursor 的交互式命令行工具，实现持续工作循环模式。

---

**📖 Documentation Languages:**

- **中文版** (Chinese): 本文档
- **English Version**: [docs/README_EN.md](docs/README_EN.md)

---

## 功能特性

- 🔄 **持续工作循环** - Cursor AI 通过 ask-me 与用户交互，无需在聊天框等待
- ⏸️ **智能暂停机制** - 基于 Cursor Hooks，事件驱动，精准控制 AI 执行
- 🪝 **原生 hooks 集成** - 监听 9 种 Cursor 事件，实时检查暂停状态
- 📊 **完整审计追踪** - 记录所有 hook 事件到统一目录，支持会话级别追踪
- 🔀 **智能配置合并** - 自动保留用户现有 hooks 配置，优先级自动排序
- 📝 **Markdown 历史记录** - 所有会话按项目和日期归档在 `~/.ask-me/projects/` 目录
- ✏️ **多编辑器支持** - 支持 VSCode、Cursor、Zed、Vim 等 15+ 编辑器
- 🎯 **跳转到行** - 自动定位到输入区域
- ⏱️ **超时提醒** - 4 分钟无输入时提供友好提示
- 🔍 **首次运行体验** - 自动检测编辑器并显示欢迎信息
- ✅ **设置验证** - 使用 Zod 验证配置文件
- 📦 **跨平台** - 支持 Windows、macOS、Linux

## 安装

### 使用 Bun（推荐）

```bash
# 克隆仓库
git clone https://github.com/HeiSir2014/ask-me.git
cd ask-me

# 安装依赖
bun install

# 全局链接
bun link
```

### 编译为独立可执行文件

```bash
# 当前平台
bun run compile

# 跨平台编译
bun run compile:windows  # Windows x64
bun run compile:linux    # Linux x64
bun run compile:macos    # macOS x64

# 编译所有平台
bun run compile:all
```

编译后的文件在 `dist/` 目录：

- `dist/windows-x64/ask-me.exe` - Windows
- `dist/linux-x64/ask-me` - Linux
- `dist/macos-x64/ask-me` - macOS (Intel)
- `dist/macos-arm64/ask-me` - macOS (Apple Silicon)

### 安装到系统 PATH

编译后运行：

```bash
# Windows (管理员权限)
.\dist\windows-x64\ask-me.exe install

# macOS/Linux
./dist/macos-x64/ask-me install
# 或
./dist/linux-x64/ask-me install
```

## 快速开始

### 1. 初始化 Cursor 规则和 Hooks

在项目目录中运行：

```bash
ask-me init
```

这会：

- 将 `ask-me.mdc` 安装到 `.cursor/rules/` 目录，启用持续工作模式
- 安装 hooks 配置到 `.cursor/hooks.json`（支持暂停检查）

#### Hooks 作用域选项

```bash
# 项目级（推荐）- hooks 仅影响当前项目
ask-me init
# 或显式指定
ask-me init --hooks project

# 用户级 - hooks 影响所有项目
ask-me init --hooks user

# 跳过 hooks 安装
ask-me init --no-hooks
```

**智能配置合并**：ask-me 会自动保留您现有的 hooks 配置，并将自己的配置放在最前面（最高优先级）。

### 2. 使用暂停功能

在任何时候暂停 AI 执行：

```bash
ask-me pause
```

恢复 AI 执行：

```bash
ask-me resume
```

检查当前暂停状态：

```bash
ask-me hooks --status
# 输出: paused 或 running
```

**工作原理**：

- 执行 `ask-me pause` 后，会创建 `.cursor/.pause-signal` 文件
- Cursor hooks 在每次操作前自动检查此文件
- 如果文件存在，AI 会立即停止并等待用户输入
- 用户输入后（运行 `ask-me` 主命令或 `ask-me resume`），自动清理暂停信号

### 3. 选择编辑器

```bash
# 查看可用编辑器
ask-me editor list

# 切换到 Cursor
ask-me editor use cursor

# 或使用自定义编辑器
ask-me editor set "code-insiders -r -w"
```

### 4. 开始使用

Cursor AI 会自动调用：

```bash
ask-me --cwd="/path/to/project" --title="Task completed" --context="Changes made..."
```

或使用短别名 `ask`：

```bash
ask --cwd="/path/to/project" --title="Task completed" --context="Changes made..."
```

## 命令参考

### 主命令

```bash
ask-me [--cwd="<path>"] [--title="<title>"] [--context="<context>"]
```

**注意**: 也可以使用短别名 `ask`，功能完全相同：

```bash
ask [--cwd="<path>"] [--title="<title>"] [--context="<context>"]
```

| 参数        | 必需 | 默认值   | 说明         |
| ----------- | ---- | -------- | ------------ |
| `--cwd`     | ❌   | 当前目录 | 工作目录路径 |
| `--title`   | ❌   | 空       | 会话标题     |
| `--context` | ❌   | 空       | 上下文信息   |

### 编辑器管理

```bash
# 列出所有可用编辑器
ask-me editor list

# 显示当前编辑器配置
ask-me editor current

# 切换到预设编辑器
ask-me editor use <name>

# 设置自定义编辑器
ask-me editor set "<command>"
```

### 初始化命令

```bash
# 初始化 Cursor 规则和 hooks 到当前项目
ask-me init

# 指定 hooks 作用域
ask-me init --hooks project   # 项目级（默认）
ask-me init --hooks user      # 用户级
ask-me init --no-hooks        # 跳过 hooks 安装
```

### 暂停/恢复命令

```bash
# 暂停 AI 执行（创建 .cursor/.pause-signal）
ask-me pause

# 恢复 AI 执行（删除暂停信号）
ask-me resume

# 检查暂停状态
ask-me hooks --status
# 输出: paused 或 running
```

### Hooks 命令（Cursor 自动调用）

```bash
# 检查暂停状态并记录审计日志（由 Cursor hooks 自动调用）
ask-me hooks

# 手动检查状态（用户使用）
ask-me hooks --status
```

### 安装命令

```bash
# 安装 CLI 到系统 PATH（仅编译版本）
ask-me install
```

### 历史记录（即将推出）

```bash
# 查看会话历史
ask-me history
```

### 帮助

```bash
ask-me --help
ask-me editor --help
```

## 支持的编辑器

| 名称            | 命令                  | 平台                  |
| --------------- | --------------------- | --------------------- |
| `vscode`        | `code -r -w`          | Windows, macOS, Linux |
| `cursor`        | `cursor -r -w`        | Windows, macOS, Linux |
| `zed`           | `zed -r -w`           | Windows, macOS, Linux |
| `sublime`       | `subl -w`             | Windows, macOS, Linux |
| `vim`           | `vim`                 | Windows, macOS, Linux |
| `nvim`          | `nvim`                | Windows, macOS, Linux |
| `emacs`         | `emacs`               | Windows, macOS, Linux |
| `nano`          | `nano`                | macOS, Linux          |
| `helix`         | `hx`                  | Windows, macOS, Linux |
| `notepad++`     | `notepad++`           | Windows               |
| `textmate`      | `mate -w`             | macOS                 |
| `atom`          | `atom -w`             | Windows, macOS, Linux |
| `pulsar`        | `pulsar -w`           | Windows, macOS, Linux |
| `fleet`         | `fleet`               | Windows, macOS, Linux |
| `lapce`         | `lapce`               | Windows, macOS, Linux |
| `code-insiders` | `code-insiders -r -w` | Windows, macOS, Linux |

## 配置文件

配置保存在 `~/.ask-me/settings.json`：

```json
{
  "env": {
    "EDITOR": "cursor -r -w"
  },
  "editorPreset": "cursor",
  "gotoFormat": "-g {file}:{line}",
  "timeoutMinutes": 4
}
```

| 字段             | 说明             | 默认值             |
| ---------------- | ---------------- | ------------------ |
| `env.EDITOR`     | 编辑器命令       | `code -r -w`       |
| `editorPreset`   | 预设编辑器名称   | `vscode`           |
| `gotoFormat`     | 跳转行格式       | `-g {file}:{line}` |
| `timeoutMinutes` | 超时时间（分钟） | `4`                |

## 文件存储结构

### 会话历史存储

```
~/.ask-me/
├── settings.json           # 配置文件
└── projects/
    └── {normalized-cwd}/   # 项目目录（基于 CWD 路径）
        ├── latest.md       # 当前会话
        ├── 2025-12-21.md   # 归档会话（按日期）
        └── 2025-12-20.md
```

### 审计日志存储（Hooks 集成）

```
~/.ask-me/
└── projects/
    └── {normalized-cwd}/
        └── {date}/         # 日期目录
            ├── pause-data.json      # 暂停元数据
            ├── pause-audit.log      # 暂停审计日志
            └── hooks-audit.jsonl    # Hook 事件审计日志
```

### 项目级文件

```
{project}/
├── .cursor/
│   ├── rules/
│   │   └── ask-me.mdc          # Cursor 规则文件
│   ├── hooks.json              # Hooks 配置
│   └── .pause-signal           # 暂停信号文件（存在时表示已暂停）
```

### 路径映射规则

- `/home/user/project` → `home-user-project/`
- `C:\Users\dev\app` → `c-users-dev-app/`
- 所有路径转换为小写，非字母数字字符替换为 `-`

### 文件格式示例

```markdown
# Project: /home/user/project

---

## Session: 2025-12-19 10:00:00

**Title**: DONE: 实现用户认证功能

**Context**:
summary: 完成 JWT 认证流程实现

changes:

- src/auth/jwt.ts (+120, -5)
- src/middleware/auth.ts (new)

next:

1. 添加测试
2. 更新文档
3. 其他

<!-- ✏️ 在此输入 | 💾 Ctrl+S 保存 | ❌ Ctrl+W 关闭 -->
```

## 工作流程

```mermaid
flowchart TD
    A[Cursor AI 执行任务] --> B[调用 ask-me]
    B --> C[编辑器打开]
    C --> D[用户输入指令]
    D --> E[保存并关闭]
    E --> F{输入是否为空?}
    F -->|是| G[显示提醒消息]
    F -->|否| H[输出到 stdout]
    G --> I[退出码 0]
    H --> I
    I --> J[Cursor AI 读取输出]
    J --> A
```

## 退出码说明

**所有退出码都是 0**（Cursor 集成要求）

| 场景               | stdout   | stderr       | 退出码 |
| ------------------ | -------- | ------------ | ------ |
| 有效输入           | 用户文本 | (空)         | 0      |
| 空输入（快速关闭） | (空)     | 快速关闭提醒 | 0      |
| 空输入（超时）     | (空)     | 超时提醒     | 0      |
| 错误               | (空)     | 错误信息     | 0      |

Cursor AI 通过检查 stdout 是否为空来判断用户是否提供了输入。

## 与 Cursor AI 集成

### 持续工作循环

```bash
# Cursor AI 调用 ask-me 并捕获 stdout
USER_INPUT=$(ask-me --cwd="..." --title="..." --context="...")

# 检查用户是否提供了输入
if [ -z "$USER_INPUT" ]; then
  # 无输入 - 提醒消息已打印到 stderr
  # 代理应重试或相应处理
else
  # 收到有效输入 - 处理它
  echo "$USER_INPUT"
fi
```

### Hooks 集成原理

ask-me 使用 Cursor 的原生 hooks 机制实现暂停功能：

1. **安装阶段**：`ask-me init` 创建 `.cursor/hooks.json` 配置
2. **触发阶段**：Cursor 在 9 种事件发生前/后自动调用 `ask-me hooks`
3. **检查阶段**：hooks 命令读取 stdin JSON，通过 `hook_event_name` 识别事件类型
4. **决策阶段**：
   - before hooks 检查暂停状态，返回 `permission: allow/deny`
   - after hooks 记录审计日志
   - beforeSubmitPrompt 清理暂停信号

### 监听的 Hook 事件

#### Before Hooks（检查暂停）

- `beforeShellExecution` - Shell 命令执行前
- `beforeMCPExecution` - MCP 工具执行前
- `beforeReadFile` - 文件读取前

#### After Hooks（记录审计）

- `afterShellExecution` - Shell 命令执行后
- `afterMCPExecution` - MCP 工具执行后
- `afterFileEdit` - 文件编辑后
- `afterAgentThought` - AI 思考后
- `afterAgentResponse` - AI 响应后

#### Control Hooks（流程控制）

- `beforeSubmitPrompt` - 用户提交前（清理暂停信号）
- `stop` - 循环结束时

### 生成的 hooks.json 示例

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      { "command": "ask-me hooks" },
      { "command": "prettier --write" },
      { "command": "eslint ." }
    ],
    "afterShellExecution": [{ "command": "ask-me hooks" }],
    "beforeMCPExecution": [{ "command": "ask-me hooks" }],
    "afterMCPExecution": [{ "command": "ask-me hooks" }],
    "beforeReadFile": [{ "command": "ask-me hooks" }],
    "afterFileEdit": [{ "command": "ask-me hooks" }],
    "beforeSubmitPrompt": [{ "command": "ask-me hooks" }],
    "afterAgentThought": [{ "command": "ask-me hooks" }],
    "afterAgentResponse": [{ "command": "ask-me hooks" }]
  }
}
```

### 审计日志格式

```json
{
  "timestamp": "2025-12-21T12:53:56.334Z",
  "hook_event": "beforeShellExecution",
  "conversation_id": "abc123",
  "generation_id": "gen456",
  "model": "claude-3-sonnet",
  "cursor_version": "0.1.7",
  "command": "npm run build",
  "duration": 1234
}
```

## 故障排除

### 编辑器未找到

```
Error: Editor command 'cursor' not found.
```

**解决方案**：

1. 确保编辑器已安装并在 PATH 中
2. 使用 `ask-me editor use <name>` 切换到其他编辑器
3. 使用 `ask-me editor set "<command>"` 设置自定义命令

### 跳转行不工作

不同编辑器使用不同的跳转语法。如果自动检测不正确，编辑 `~/.ask-me/settings.json`：

```json
{
  "gotoFormat": "+{line} {file}"
}
```

常见格式：

- VSCode/Cursor: `-g {file}:{line}`
- Zed: `{file}:{line}:{column}`
- Vim/Nvim/Nano/Emacs: `+{line} {file}`
- Notepad++: `-n{line} {file}`
- TextMate: `-l {line} {file}`

### Windows 路径问题

ask-me 自动处理 Windows 路径：

- 反斜杠 `\` 转换为 `-`
- 冒号 `:` 被移除
- 大小写不敏感比较

### 设置文件损坏

如果 `~/.ask-me/settings.json` 损坏，ask-me 会自动重置为默认值并显示警告。

## 开发

```bash
# 运行开发版本
bun run start

# 构建
bun run build

# 编译
bun run compile
```

## 许可证

MIT
