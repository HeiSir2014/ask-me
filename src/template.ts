import type { CLIOptions } from './types.ts';
import pkg from '../package.json';

// Input marker for detecting user input area
const INPUT_SECTION_MARKER = '### User Input';
const INPUT_HINT = '<!-- ✏️ Type below | 💾 Ctrl+S to save | ❌ Ctrl+W to close -->';

// Format current timestamp
function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Unescape \n to real newlines and normalize whitespace
function unescapeNewlines(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd()) // Remove trailing whitespace per line
    .join('\n');
}

// Generate session block content
function generateSessionBlock(options: CLIOptions): string {
  const timestamp = formatTimestamp();
  const rawTitle = unescapeNewlines(options.title);
  // Default to timestamp if title is empty
  const title = rawTitle.trim() || `Session ${timestamp}`;
  const context = options.context ? unescapeNewlines(options.context) : '';

  const contextSection = context ? `\n**Context**:\n${context}\n` : '';

  // Template ends with empty line for user input
  return `
---

## Session: ${timestamp}

**Title**: ${title}
${contextSection}
${INPUT_SECTION_MARKER} ${INPUT_HINT}

`;
}

// Generate file header with meta info
function generateFileHeader(cwd: string): string {
  const createdAt = formatTimestamp();
  return `<!-- markdownlint-disable -->
---
created: "${createdAt}"
version: "${pkg.version}"
cwd: "${cwd}"
---

# Project: ${cwd}
`;
}

// Generate new file content with header and first session
export function generateNewFileContent(options: CLIOptions): {
  content: string;
  inputLine: number;
} {
  const header = generateFileHeader(options.cwd);
  const sessionBlock = generateSessionBlock(options);
  const content = header + sessionBlock;

  // Calculate line number - jump to the last line (where user types)
  const lines = content.split('\n');
  // Last non-empty line or just the last line
  const inputLine = lines.length;

  return { content, inputLine };
}

// Append new session to existing file
export function appendToExistingFile(
  existing: string,
  options: CLIOptions
): { content: string; inputLine: number } {
  const sessionBlock = generateSessionBlock(options);
  const content = existing.trimEnd() + '\n' + sessionBlock;

  // Calculate line number - jump to the last line (where user types)
  const lines = content.split('\n');
  // Last non-empty line or just the last line
  const inputLine = lines.length;

  return { content, inputLine };
}

// Extract the latest user input from file content
export function extractUserInput(content: string): string {
  // Find the last "### User Input" section
  const sections = content.split(INPUT_SECTION_MARKER);
  if (sections.length < 2) {
    return '';
  }

  // Get the last section (after the last "### User Input")
  let lastSection = sections[sections.length - 1];
  if (!lastSection) {
    return '';
  }

  // Remove the hint comment if present
  lastSection = lastSection.replace(INPUT_HINT, '');

  // Extract content until the next "---" or end of file
  const endIndex = lastSection.indexOf('\n---');
  const inputContent = endIndex !== -1 ? lastSection.slice(0, endIndex) : lastSection;

  // Trim and return
  return inputContent.trim();
}

// Check if input is empty
export function isInputEmpty(input: string): boolean {
  if (!input) {
    return true;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return true;
  }

  return false;
}
