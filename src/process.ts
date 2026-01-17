import psList from "ps-list";
import pidusage from "pidusage";
import { execSync } from "child_process";

const isWindows = process.platform === "win32";

// Cache for Windows command lines (to avoid calling wmic too often)
let cmdLineCache: Map<number, string> = new Map();
let lastCmdLineFetch = 0;
const CMD_LINE_CACHE_TTL = 5000; // 5 seconds

/**
 * Get command lines for processes on Windows using WMIC
 */
function getWindowsCommandLines(pids: number[]): Map<number, string> {
  const now = Date.now();

  // Return cache if still fresh
  if (now - lastCmdLineFetch < CMD_LINE_CACHE_TTL && cmdLineCache.size > 0) {
    return cmdLineCache;
  }

  try {
    const output = execSync('wmic process get ProcessId,CommandLine /format:csv', {
      encoding: 'utf-8',
      timeout: 5000,
      windowsHide: true,
    });

    const newCache = new Map<number, string>();
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('Node,')) continue;

      // CSV format: Node,CommandLine,ProcessId
      const lastComma = trimmed.lastIndexOf(',');
      if (lastComma === -1) continue;

      const pidStr = trimmed.slice(lastComma + 1).trim();
      const pid = parseInt(pidStr, 10);
      if (isNaN(pid)) continue;

      // Get command line (everything between first comma and last comma)
      const firstComma = trimmed.indexOf(',');
      if (firstComma === -1 || firstComma >= lastComma) continue;

      const cmdLine = trimmed.slice(firstComma + 1, lastComma).trim();
      if (cmdLine) {
        newCache.set(pid, cmdLine);
      }
    }

    cmdLineCache = newCache;
    lastCmdLineFetch = now;
    return cmdLineCache;
  } catch {
    return cmdLineCache; // Return old cache on error
  }
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd?: string;
  cpu: number;
  memory: number;
  memoryMB: number;
}

export interface ProcessStats {
  pid: number;
  cpu: number;
  memory: number;
  elapsed: number;
  timestamp: number;
}

export async function getProcesses(
  processNames: string[],
  filterPattern?: string
): Promise<ProcessInfo[]> {
  try {
    const processes = await psList();

    // Filter by process name (empty processNames means get all - used for Docker mode)
    const filtered = processes.filter((proc) => {
      // If no process names specified, include all (for Docker mode)
      if (processNames.length === 0) {
        return true;
      }

      const procName = proc.name.toLowerCase();
      const matches = processNames.some((name) =>
        procName === name.toLowerCase() ||
        procName.startsWith(name.toLowerCase())
      );

      if (!matches) return false;

      // Apply command filter if specified
      if (filterPattern && proc.cmd) {
        return proc.cmd.toLowerCase().includes(filterPattern.toLowerCase());
      }

      return true;
    });

    if (filtered.length === 0) {
      return [];
    }

    // Get CPU/memory stats for filtered processes
    const pids = filtered.map((p) => p.pid);
    const stats = await getProcessStats(pids);

    // On Windows, get command lines via WMIC since ps-list doesn't provide them
    let windowsCmdLines: Map<number, string> | null = null;
    if (isWindows) {
      windowsCmdLines = getWindowsCommandLines(pids);
    }

    return filtered.map((proc) => {
      const stat = stats[proc.pid];
      // Use Windows command line if available, otherwise fall back to ps-list cmd
      const cmd = (isWindows && windowsCmdLines?.get(proc.pid)) || proc.cmd;

      // Apply filter using the actual command line
      if (filterPattern && cmd) {
        if (!cmd.toLowerCase().includes(filterPattern.toLowerCase())) {
          return null;
        }
      }

      return {
        pid: proc.pid,
        name: proc.name,
        cmd,
        cpu: stat?.cpu ?? 0,
        memory: stat?.memory ?? 0,
        memoryMB: (stat?.memory ?? 0) / (1024 * 1024),
      };
    }).filter((p): p is ProcessInfo => p !== null);
  } catch (error) {
    console.error("Error getting processes:", error);
    return [];
  }
}

export async function getProcessStats(
  pids: number[]
): Promise<Record<number, ProcessStats>> {
  try {
    if (pids.length === 0) return {};
    const stats = await pidusage(pids);
    return stats as Record<number, ProcessStats>;
  } catch (error) {
    // Some processes might have exited
    return {};
  }
}

/**
 * Get command line for a specific PID (uses WMIC on Windows)
 */
export function getProcessCommandLine(pid: number): string | undefined {
  if (!isWindows) {
    return undefined; // On non-Windows, ps-list provides cmd
  }

  const cmdLines = getWindowsCommandLines([pid]);
  return cmdLines.get(pid);
}

export function formatCommand(cmd: string | undefined, maxLength: number = 50): string {
  if (!cmd) return "-";

  // Truncate and add ellipsis if too long
  if (cmd.length > maxLength) {
    return cmd.substring(0, maxLength - 3) + "...";
  }

  return cmd;
}

/**
 * Extract script/file path from a command line
 * Looks for common script extensions like .py, .js, .ts, .rb, .php, etc.
 * Returns the FULL path, not just the filename
 * If script is relative but executable is in a venv/node_modules, infers project path
 */
export function extractScriptName(cmd: string | undefined): string | undefined {
  if (!cmd) return undefined;

  const extensions = ['py', 'pyw', 'js', 'ts', 'mjs', 'cjs', 'jsx', 'tsx', 'rb', 'php', 'pl', 'sh', 'ps1', 'bat', 'cmd'];

  // Split command into parts, respecting quotes
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
      if (current) {
        parts.push(current);
        current = '';
      }
    } else if (char === ' ' && !inQuote) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) {
    parts.push(current);
  }

  // Look for script files in the parts - prefer full paths
  let bestMatch: string | undefined;
  let executablePath: string | undefined;

  for (const part of parts) {
    const cleanPart = part.trim();
    if (!cleanPart) continue;

    const lowerPart = cleanPart.toLowerCase();

    // Track executable path (for inferring project directory)
    if (lowerPart.endsWith('.exe') || lowerPart.includes('python') || lowerPart.includes('node') || lowerPart.includes('bun')) {
      if (/^[A-Za-z]:/.test(cleanPart) || cleanPart.startsWith('/')) {
        executablePath = cleanPart;
      }
    }

    // Check if this part ends with a script extension
    for (const ext of extensions) {
      if (lowerPart.endsWith('.' + ext)) {
        // Check if it's a full path (has drive letter or starts with / or has path separators)
        const hasFullPath = /^[A-Za-z]:/.test(cleanPart) ||
                           cleanPart.startsWith('/') ||
                           cleanPart.includes('\\') ||
                           cleanPart.includes('/');

        if (hasFullPath) {
          // This is a full path - return immediately
          return cleanPart;
        } else if (!bestMatch) {
          // This is just a filename - save as fallback
          bestMatch = cleanPart;
        }
      }
    }
  }

  // If we only found a relative script name, try to infer full path from executable
  if (bestMatch && executablePath) {
    const inferredPath = inferProjectPath(executablePath, bestMatch);
    if (inferredPath) {
      return inferredPath;
    }
  }

  return bestMatch;
}

/**
 * Infer full script path from executable location
 * Works for venv (Python), node_modules/.bin (Node), etc.
 */
function inferProjectPath(executablePath: string, scriptName: string): string | undefined {
  // Normalize path separators
  const normExec = executablePath.replace(/\//g, '\\');

  // Check for Python venv: .venv/Scripts/python.exe or venv/Scripts/python.exe
  const venvMatch = normExec.match(/^(.+?)[\\\/]\.?venv[\\\/]/i);
  if (venvMatch) {
    return venvMatch[1] + '\\' + scriptName;
  }

  // Check for node_modules/.bin
  const nodeModulesMatch = normExec.match(/^(.+?)[\\\/]node_modules[\\\/]/i);
  if (nodeModulesMatch) {
    return nodeModulesMatch[1] + '\\' + scriptName;
  }

  return undefined;
}

/**
 * Format script name, truncating from start if too long
 */
export function formatScriptName(scriptPath: string | undefined, maxLength: number = 40): string {
  if (!scriptPath) return "";

  if (scriptPath.length <= maxLength) {
    return scriptPath;
  }

  // Truncate from start, keeping the end (most relevant part)
  return "..." + scriptPath.slice(-(maxLength - 3));
}

export function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  }
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function formatCPU(cpu: number): string {
  return `${cpu.toFixed(1)}%`;
}
