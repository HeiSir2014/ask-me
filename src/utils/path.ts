import { resolve } from 'path';

// 规范化 CWD 路径为安全的目录名
export function normalizeCwdPath(cwd: string): string {
  // Resolve to absolute path first (handles "." and relative paths)
  let absolutePath = resolve(cwd);

  // Normalize to lowercase on Windows (case-insensitive filesystem)
  if (process.platform === 'win32') {
    absolutePath = absolutePath.toLowerCase();
  }

  let normalized = absolutePath
    .replace(/\\/g, '-') // Windows 路径分隔符替换为 '-'
    .replace(/\//g, '-') // Unix 路径分隔符替换为 '-'
    .replace(/:/g, '') // 移除驱动器冒号 (Windows)
    .replace(/^-+/, '') // 去除首部的 '-'
    .replace(/-+$/, '') // 去除尾部的 '-'
    .replace(/-+/g, '-'); // 折叠多个连续的 '-' 为单个 '-'

  // 确保名称不为空
  if (!normalized) {
    normalized = 'default';
  }

  return normalized;
}
